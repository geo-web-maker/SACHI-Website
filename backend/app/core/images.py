"""Shared helpers for hash-aware image export/import.

Identity of an image = SHA-256 of its original bytes. The hash is stored next
to every image (``sha256``) and is what import uses to recognise "this is the
same picture that is already in the system", whatever its filename or URL.
"""
import asyncio
import hashlib
import mimetypes
import re
import tempfile
import zipfile
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx
from fastapi.responses import StreamingResponse

from app.core.config import settings

MAX_IMAGE_BYTES = 25 * 1024 * 1024
FETCH_CONCURRENCY = 6
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
_KNOWN_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg"}


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


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


async def fetch_many(urls) -> dict[str, Fetched]:
    urls = list(dict.fromkeys(urls))
    sem = asyncio.Semaphore(FETCH_CONCURRENCY)
    async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:

        async def worker(u: str):
            async with sem:
                return u, await _fetch_one(client, u)

        return dict(await asyncio.gather(*(worker(u) for u in urls)))


async def ensure_hashes(db) -> None:
    """Backfill ``sha256`` for images saved before hashes existed (once; cached in the DB)."""
    todo: list[tuple] = []
    async for p in db.programmes.find({}, {"images": 1}):
        for img in p.get("images", []):
            if img.get("image_url") and not img.get("sha256"):
                todo.append(("p", p["_id"], img["id"], img["image_url"]))
    async for g in db.gallery_photos.find(
        {"image_url": {"$nin": [None, ""]}, "sha256": {"$in": [None, ""]}}, {"image_url": 1}
    ):
        todo.append(("g", g["_id"], None, g["image_url"]))
    if not todo:
        return
    fetched = await fetch_many(t[3] for t in todo)
    for kind, doc_id, image_id, url in todo:
        res = fetched.get(url)
        if res is None or res.data is None:
            continue
        digest = sha256_hex(res.data)
        if kind == "p":
            await db.programmes.update_one(
                {"_id": doc_id},
                {"$set": {"images.$[img].sha256": digest}},
                array_filters=[{"img.id": image_id}],
            )
        else:
            await db.gallery_photos.update_one({"_id": doc_id}, {"$set": {"sha256": digest}})


def merge_images(existing: list[dict], incoming: list[dict], remove_unlisted: bool = False):
    """Merge imported photos into a programme's existing photos.

    An incoming photo is the *same* photo as an existing one when (in order):
      1. its sha256 equals the existing photo's sha256          (same picture)
      2. its image_url equals the existing photo's image_url     (same hosted file)
      3. it carries no picture at all and its id equals the id   (caption-only slot)
    A match keeps the existing photo and only updates its caption (the picture is
    never re-uploaded). Anything unmatched is added. Existing photos missing from
    the import are kept unless ``remove_unlisted``.
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
            e = take(lambda x: x["id"] == inc["id"] and not x.get("image_url"))
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

    reserved = {m["id"] for m in merged if m not in new_ids}
    for fresh in new_ids:  # new photos never steal or rename an existing photo's id
        base, n = fresh["id"], 2
        while fresh["id"] in reserved:
            fresh["id"] = f"{base}-{n}"
            n += 1
        reserved.add(fresh["id"])
    return merged, {"matched": matched, "added": added, "removed": removed, "kept": kept}


def zip_response(files: list[tuple[str, bytes]], filename: str) -> StreamingResponse:
    spool = tempfile.SpooledTemporaryFile(max_size=64 * 1024 * 1024)
    with zipfile.ZipFile(spool, "w") as zf:
        for path, data in files:
            # JPEG/PNG/WebP are already compressed; only deflate the text files.
            ctype = zipfile.ZIP_STORED if path.startswith("images/") else zipfile.ZIP_DEFLATED
            zf.writestr(path, data, compress_type=ctype)
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
