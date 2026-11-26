"""Shared helpers for hash-aware image export/import.

Identity of an image = SHA-256 of its original bytes. The hash is stored next
to every image (``sha256``) and is what import uses to recognise "this is the
same picture that is already in the system", whatever its filename or URL.

Memory model: images are downloaded a few at a time (``FETCH_CONCURRENCY``),
hashed/written, then dropped. Nothing here ever holds the whole library in RAM.
"""
import asyncio
import hashlib
import mimetypes
import re
import tempfile
import time
import zipfile
from contextlib import asynccontextmanager
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.config import settings

MAX_IMAGE_BYTES = 25 * 1024 * 1024
FETCH_CONCURRENCY = 4  # also the max number of image bodies in memory at once
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
_KNOWN_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg"}


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


async def hash_bytes(data: bytes) -> str:
    """sha256_hex off the event loop, so hashing big photos doesn't stall other requests."""
    return await asyncio.to_thread(sha256_hex, data)


def is_allowed_image_url(url: str) -> bool:
    """Only https URLs on configured image hosts are ever fetched server-side."""
    p = urlparse(url)
    if p.scheme != "https" or not p.hostname:
        return False
    host = p.hostname.lower()
    return any(host == s or host.endswith("." + s) for s in settings.image_host_suffix_list)


def image_extension(url: str, content_type: str = "") -> str:
    suffix = "." + urlparse(url).path.rsplit(".", 1)[-1].lower() if "." in urlparse(url).path else ""
    if suffix in _KNOWN_EXT:
        return ".jpg" if suffix == ".jpeg" else suffix
    guessed = mimetypes.guess_extension(content_type.split(";")[0].strip()) if content_type else None
    return ".jpg" if guessed in (None, ".jpe", ".jpeg") else guessed


def safe_name(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-") or "image"


@dataclass
class Fetched:
    data: bytes | None
    content_type: str = ""
    error: str = ""


async def _fetch_one(client: httpx.AsyncClient, url: str) -> Fetched:
    try:
        if not is_allowed_image_url(url):
            return Fetched(None, error="image host not allowed")
        async with client.stream("GET", url) as r:
            r.raise_for_status()
            buf = bytearray()
            async for chunk in r.aiter_bytes():
                buf += chunk
                if len(buf) > MAX_IMAGE_BYTES:
                    return Fetched(None, error="image too large")
            return Fetched(bytes(buf), r.headers.get("content-type", ""))
    except Exception as exc:  # noqa: BLE001
        return Fetched(None, error=str(exc) or exc.__class__.__name__)


async def iter_fetched(urls):
    """Yield ``(url, Fetched)`` for each distinct url, FETCH_CONCURRENCY at a time.

    The consumer handles (hashes / writes) a batch before the next batch is
    downloaded, so at most FETCH_CONCURRENCY bodies are alive at once. Callers
    that stop early should ``await gen.aclose()`` on the generator.
    """
    urls = list(dict.fromkeys(urls))
    async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:
        for i in range(0, len(urls), FETCH_CONCURRENCY):
            batch = urls[i : i + FETCH_CONCURRENCY]
            results = await asyncio.gather(*(_fetch_one(client, u) for u in batch))
            for u, res in zip(batch, results):
                yield u, res


# ── Hash backfill ──────────────────────────────────────────────────────────

_FAIL_TTL_SECONDS = 3600
_failed: dict[str, float] = {}  # url -> monotonic time of last failed download
_backfill_lock = asyncio.Lock()


def _recently_failed(url: str) -> bool:
    t = _failed.get(url)
    if t is None:
        return False
    if time.monotonic() - t > _FAIL_TTL_SECONDS:
        del _failed[url]
        return False
    return True


async def _store_hash(db, refs: list[tuple], digest: str) -> None:
    for kind, doc_id, image_id in refs:
        if kind == "p":
            await db.programmes.update_one(
                {"_id": doc_id},
                {"$set": {"images.$[img].sha256": digest}},
                array_filters=[{"img.id": image_id}],
            )
        else:
            await db.gallery_photos.update_one({"_id": doc_id}, {"$set": {"sha256": digest}})


async def ensure_hashes(db, budget_seconds: float = 40.0) -> int:
    """Backfill ``sha256`` for images saved before hashes existed.

    Each hash is saved the moment it is computed, so progress survives a timeout
    or restart, and work stops after ``budget_seconds`` so a request never runs
    unbounded. Images that can't be downloaded are not retried for an hour.

    Returns how many images still need a hash (0 = finished); callers should
    call again while the result is non-zero.
    """
    async with _backfill_lock:  # concurrent callers wait, then find little left to do
        targets: dict[str, list[tuple]] = {}  # url -> [(kind, doc_id, image_id), ...]
        async for p in db.programmes.find({}, {"images": 1}):
            for img in p.get("images", []):
                url = img.get("image_url")
                if url and not img.get("sha256") and not _recently_failed(url):
                    targets.setdefault(url, []).append(("p", p["_id"], img["id"]))
        async for g in db.gallery_photos.find(
            {"image_url": {"$nin": [None, ""]}, "sha256": {"$in": [None, ""]}}, {"image_url": 1}
        ):
            if not _recently_failed(g["image_url"]):
                targets.setdefault(g["image_url"], []).append(("g", g["_id"], None))
        if not targets:
            return 0

        deadline = time.monotonic() + budget_seconds
        remaining = len(targets)
        gen = iter_fetched(targets)
        try:
            async for url, res in gen:
                if res.data is None:
                    _failed[url] = time.monotonic()
                else:
                    await _store_hash(db, targets[url], await hash_bytes(res.data))
                remaining -= 1
                if time.monotonic() > deadline:
                    break
        finally:
            await gen.aclose()
        return remaining


# ── Import merge ───────────────────────────────────────────────────────────


def merge_images(existing: list[dict], incoming: list[dict], remove_unlisted: bool = False):
    """Merge imported photos into a programme's existing photos.

    An incoming photo is the *same* photo as an existing one when (in order):
      1. its sha256 equals the existing photo's sha256          (same picture)
      2. its image_url equals the existing photo's image_url     (same hosted file)
      3. it carries no picture at all and its id equals the id   (caption-only row)
    A match keeps the existing photo (and its picture) and only updates its
    caption; the picture is never re-uploaded. Anything unmatched is added.
    Existing photos missing from the import are kept unless ``remove_unlisted``.
    """
    pool = [dict(e) for e in existing]
    used: set[int] = set()

    def take(pred):
        for idx, e in enumerate(pool):
            if idx not in used and pred(e):
                used.add(idx)
                return e
        return None

    merged: list[dict] = []
    new_ids: list[dict] = []
    matched = added = 0
    for inc in incoming:
        sha, url = inc.get("sha256"), inc.get("image_url")
        e = None
        if sha:
            e = take(lambda x: x.get("sha256") == sha)
        if e is None and url:
            e = take(lambda x: x.get("image_url") == url)
        if e is None and not sha and not url:
            e = take(lambda x: x["id"] == inc["id"])
        if e is not None:
            e["caption"] = inc["caption"]
            if sha and not e.get("sha256"):
                e["sha256"] = sha
            if url and not e.get("image_url"):
                e["image_url"] = url
            merged.append(e)
            matched += 1
        else:
            fresh = {"id": inc["id"], "caption": inc["caption"], "image_url": url, "sha256": sha}
            merged.append(fresh)
            new_ids.append(fresh)
            added += 1

    leftovers = [e for i, e in enumerate(pool) if i not in used]
    removed = len(leftovers) if remove_unlisted else 0
    kept = 0 if remove_unlisted else len(leftovers)
    if not remove_unlisted:
        merged.extend(leftovers)

    reserved = {m["id"] for m in merged if not any(m is n for n in new_ids)}
    for fresh in new_ids:  # new photos never steal or rename an existing photo's id
        base, n = fresh["id"], 2
        while fresh["id"] in reserved:
            fresh["id"] = f"{base}-{n}"
            n += 1
        reserved.add(fresh["id"])
    return merged, {"matched": matched, "added": added, "removed": removed, "kept": kept}


# ── Export ─────────────────────────────────────────────────────────────────

_export_lock = asyncio.Lock()


@asynccontextmanager
async def single_export():
    """Only one ZIP export runs at a time (each one downloads the whole library)."""
    if _export_lock.locked():
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Another export is running. Try again in a minute.")
    async with _export_lock:
        yield


class ZipBuilder:
    """Builds a ZIP incrementally (spooled to disk past 16 MB) so images can be
    written one at a time instead of all being held in memory first."""

    def __init__(self) -> None:
        self._spool = tempfile.SpooledTemporaryFile(max_size=16 * 1024 * 1024)
        self._zf = zipfile.ZipFile(self._spool, "w")

    def _write(self, path: str, data: bytes) -> None:
        # JPEG/PNG/WebP are already compressed; only deflate the text files.
        ctype = zipfile.ZIP_STORED if path.startswith("images/") else zipfile.ZIP_DEFLATED
        self._zf.writestr(path, data, compress_type=ctype)

    async def add(self, path: str, data: bytes) -> None:
        await asyncio.to_thread(self._write, path, data)

    def close(self) -> None:
        """Discard everything (use when the export fails part-way)."""
        try:
            self._zf.close()
        finally:
            self._spool.close()

    def response(self, filename: str) -> StreamingResponse:
        self._zf.close()
        spool = self._spool
        size = spool.tell()
        spool.seek(0)

        def stream():
            try:
                while chunk := spool.read(1024 * 1024):
                    yield chunk
            finally:
                spool.close()

        return StreamingResponse(
            stream(),
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{filename}"', "Content-Length": str(size)},
        )
