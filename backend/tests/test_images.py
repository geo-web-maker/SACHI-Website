import asyncio
import hashlib
import io
import zipfile

import pytest
from fastapi import HTTPException

from app.core import images as im
from tests.fakes import FakeDB

run = asyncio.run


def digest_of(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()


@pytest.fixture(autouse=True)
def _reset_state():
    im._failed.clear()
    yield
    im._failed.clear()


def patch_fetch(monkeypatch, fail=(), calls=None, delay=0.0):
    """Replace the network call: body == the url's bytes; urls in `fail` error out."""

    async def fake(client, url):
        if calls is not None:
            calls.append(url)
        if delay:
            await asyncio.sleep(delay)
        if url in fail:
            return im.Fetched(None, error="boom")
        return im.Fetched(url.encode(), "image/jpeg")

    monkeypatch.setattr(im, "_fetch_one", fake)


# ── pure helpers ───────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "url,ok",
    [
        ("https://res.cloudinary.com/x/a.jpg", True),
        ("https://cloudinary.com/a", True),
        ("https://RES.Cloudinary.com/a.PNG", True),
        ("http://res.cloudinary.com/a", False),
        ("https://evilcloudinary.com/a", False),
        ("https://cloudinary.com.evil.com/a", False),
        ("https://cloudinary.com@evil.com/a", False),
        ("https://evil.com/.cloudinary.com", False),
        ("https://127.0.0.1/a", False),
        ("", False),
    ],
)
def test_is_allowed_image_url(url, ok):
    assert im.is_allowed_image_url(url) is ok


def test_image_extension():
    assert im.image_extension("https://h/x/a.jpeg") == ".jpg"
    assert im.image_extension("https://h/x/a.PNG") == ".png"
    assert im.image_extension("https://h/x/abc", "image/webp") == ".webp"
    assert im.image_extension("https://h/x/abc.php") == ".jpg"  # unknown suffix, no type -> jpg


def test_safe_name():
    assert "/" not in im.safe_name("../../etc/passwd")
    assert im.safe_name("***") == "image"


# ── merge_images ───────────────────────────────────────────────────────────

EXISTING = [
    {"id": "a", "caption": "A", "image_url": "u1", "sha256": "h1"},
    {"id": "b", "caption": "B", "image_url": "u2", "sha256": None},
]


def test_merge_matches_by_hash_even_if_url_and_id_differ():
    merged, st = im.merge_images(
        EXISTING, [{"id": "zzz", "caption": "A2", "image_url": "other", "sha256": "h1"}]
    )
    assert st == {"matched": 1, "added": 0, "removed": 0, "kept": 1}
    a = next(m for m in merged if m["id"] == "a")
    assert a["caption"] == "A2" and a["image_url"] == "u1"  # picture untouched


def test_merge_matches_by_url_when_no_hash():
    merged, st = im.merge_images(EXISTING, [{"id": "q", "caption": "B!", "image_url": "u2", "sha256": None}])
    assert st["matched"] == 1 and st["added"] == 0
    assert next(m for m in merged if m["id"] == "b")["caption"] == "B!"


def test_merge_caption_only_row_updates_existing_photo_that_has_a_picture():
    merged, st = im.merge_images(EXISTING, [{"id": "b", "caption": "B!", "image_url": None, "sha256": None}])
    assert st["matched"] == 1 and st["added"] == 0
    b = next(m for m in merged if m["id"] == "b")
    assert b["caption"] == "B!" and b["image_url"] == "u2"  # not duplicated, picture kept


def test_merge_new_photo_never_steals_an_existing_id():
    merged, st = im.merge_images(EXISTING, [{"id": "a", "caption": "new", "image_url": "u9", "sha256": "h9"}])
    assert st["added"] == 1
    ids = [m["id"] for m in merged]
    assert len(ids) == len(set(ids))
    assert next(m for m in merged if m["image_url"] == "u1")["id"] == "a"
    assert next(m for m in merged if m["image_url"] == "u9")["id"] == "a-2"


def test_merge_remove_unlisted():
    merged, st = im.merge_images(EXISTING, [{"id": "a", "caption": "A", "image_url": None, "sha256": "h1"}], True)
    assert [m["id"] for m in merged] == ["a"]
    assert st["removed"] == 1 and st["kept"] == 0


# ── iter_fetched ───────────────────────────────────────────────────────────


def test_iter_fetched_limits_concurrency_and_dedupes(monkeypatch):
    in_flight = 0
    peak = 0

    async def fake(client, url):
        nonlocal in_flight, peak
        in_flight += 1
        peak = max(peak, in_flight)
        await asyncio.sleep(0.01)
        in_flight -= 1
        return im.Fetched(b"x", "image/jpeg")

    monkeypatch.setattr(im, "_fetch_one", fake)
    urls = [f"https://res.cloudinary.com/{i}.jpg" for i in range(13)]

    async def go():
        return [u async for u, _ in im.iter_fetched(urls + urls[:3])]

    got = run(go())
    assert got == urls  # each url once, in order
    assert peak <= im.FETCH_CONCURRENCY


# ── ensure_hashes ──────────────────────────────────────────────────────────

U1, U2, U3, U4, U5 = (f"https://res.cloudinary.com/demo/{n}.jpg" for n in "abcde")


def make_db():
    return FakeDB(
        programmes=[
            {
                "_id": 1,
                "images": [
                    {"id": "a", "image_url": U1, "sha256": None},
                    {"id": "b", "image_url": U2, "sha256": "x" * 64},  # already hashed: skipped
                ],
            }
        ],
        gallery_photos=[
            {"_id": 10, "image_url": U3},  # no sha256 key
            {"_id": 11, "image_url": U4, "sha256": ""},  # empty sha256
            {"_id": 12, "image_url": U5, "sha256": "y" * 64},  # already hashed: skipped
            {"_id": 13, "image_url": None},  # no picture: skipped
        ],
    )


def test_ensure_hashes_saves_every_missing_hash_and_returns_zero(monkeypatch):
    calls = []
    patch_fetch(monkeypatch, calls=calls)
    db = make_db()

    assert run(im.ensure_hashes(db)) == 0

    assert sorted(calls) == sorted([U1, U3, U4])  # only the unhashed ones were downloaded
    assert db.programmes.docs[0]["images"][0]["sha256"] == digest_of(U1)
    assert db.programmes.docs[0]["images"][1]["sha256"] == "x" * 64
    by_id = {d["_id"]: d for d in db.gallery_photos.docs}
    assert by_id[10]["sha256"] == digest_of(U3)
    assert by_id[11]["sha256"] == digest_of(U4)
    assert by_id[12]["sha256"] == "y" * 64


def test_ensure_hashes_is_time_boxed_and_keeps_progress(monkeypatch):
    urls = [f"https://res.cloudinary.com/demo/{i}.jpg" for i in range(10)]
    db = FakeDB(gallery_photos=[{"_id": i, "image_url": u} for i, u in enumerate(urls)])
    patch_fetch(monkeypatch)

    remaining = run(im.ensure_hashes(db, budget_seconds=0))
    assert 0 < remaining < len(urls)  # stopped early, but made progress
    done = [d for d in db.gallery_photos.docs if d.get("sha256")]
    assert len(done) == len(urls) - remaining  # progress was saved, not lost

    assert run(im.ensure_hashes(db)) == 0  # a later call finishes the job
    assert all(d["sha256"] == digest_of(d["image_url"]) for d in db.gallery_photos.docs)


def test_ensure_hashes_does_not_retry_failed_downloads(monkeypatch):
    calls = []
    patch_fetch(monkeypatch, fail={U3}, calls=calls)
    db = FakeDB(gallery_photos=[{"_id": 1, "image_url": U3}])

    assert run(im.ensure_hashes(db)) == 0  # failure counts as handled, not pending
    assert run(im.ensure_hashes(db)) == 0
    assert calls == [U3]  # downloaded once, not on every call
    assert "sha256" not in db.gallery_photos.docs[0]


def test_ensure_hashes_nothing_to_do_makes_no_requests(monkeypatch):
    calls = []
    patch_fetch(monkeypatch, calls=calls)
    db = FakeDB(gallery_photos=[{"_id": 1, "image_url": U1, "sha256": "z" * 64}])
    assert run(im.ensure_hashes(db)) == 0
    assert calls == []


# ── ZipBuilder / single_export ─────────────────────────────────────────────


async def read_body(resp) -> bytes:
    return b"".join([c async for c in resp.body_iterator])


def test_zip_builder_roundtrip_and_compression_choice():
    async def go():
        zb = im.ZipBuilder()
        await zb.add("a.json", b"{}" * 500)
        await zb.add("images/x.jpg", b"\xff" * 1000)
        resp = zb.response("t.zip")
        return resp, await read_body(resp)

    resp, data = run(go())
    assert resp.headers["content-length"] == str(len(data))
    assert resp.headers["content-disposition"] == 'attachment; filename="t.zip"'
    zf = zipfile.ZipFile(io.BytesIO(data))
    assert zf.testzip() is None
    assert zf.getinfo("images/x.jpg").compress_type == zipfile.ZIP_STORED
    assert zf.getinfo("a.json").compress_type == zipfile.ZIP_DEFLATED
    assert zf.read("images/x.jpg") == b"\xff" * 1000


def test_single_export_rejects_a_second_concurrent_export():
    async def go():
        async with im.single_export():
            with pytest.raises(HTTPException) as exc:
                async with im.single_export():
                    pass
            return exc.value.status_code

    assert run(go()) == 429
    # and the lock is released afterwards
    async def again():
        async with im.single_export():
            return True

    assert run(again()) is True
