"""Handler-level tests for export.zip and /images/lookup, using in-memory fake collections."""
import asyncio
import csv
import hashlib
import io
import json
import zipfile

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.core import images as im
from app.routers import gallery, media, programmes
from tests.fakes import FakeDB

run = asyncio.run

A = "https://res.cloudinary.com/demo/image/upload/a.jpg"
B = "https://res.cloudinary.com/demo/image/upload/b.png"
BAD = "https://res.cloudinary.com/demo/image/upload/missing.jpg"

ADMIN = {"is_super_admin": True}
VIEW_ONLY_GALLERY = {"permissions": {"gallery": {"view": True}}}
VIEW_ONLY_PROGRAMMES = {"permissions": {"programmes": {"view": True}}}


def sha(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()


@pytest.fixture(autouse=True)
def fake_network(monkeypatch):
    im._failed.clear()

    async def fake(client, url):
        if url == BAD:
            return im.Fetched(None, error="404")
        return im.Fetched(url.encode(), "image/png" if url.endswith(".png") else "image/jpeg")

    monkeypatch.setattr(im, "_fetch_one", fake)


async def read_zip(resp) -> zipfile.ZipFile:
    data = b"".join([c async for c in resp.body_iterator])
    return zipfile.ZipFile(io.BytesIO(data))


# ── gallery export ─────────────────────────────────────────────────────────


def gallery_db():
    ids = [ObjectId(), ObjectId(), ObjectId()]
    db = FakeDB(
        gallery_photos=[
            {"_id": ids[0], "caption": "one", "image_url": A},
            {"_id": ids[1], "caption": "broken", "image_url": BAD, "sha256": "k" * 64},
            {"_id": ids[2], "caption": "no picture"},
        ]
    )
    return db, ids


def test_gallery_export_contents():
    db, ids = gallery_db()

    async def go():
        resp = await gallery.export_gallery_zip(user=ADMIN, db=db)
        return await read_zip(resp)

    zf = run(go())
    names = zf.namelist()
    assert f"images/001-{ids[0]}.jpg" in names
    assert {"gallery.json", "captions.csv", "export-warnings.txt"} <= set(names)
    assert zf.read(f"images/001-{ids[0]}.jpg") == A.encode()

    photos = json.loads(zf.read("gallery.json"))
    assert photos[0] == {"id": str(ids[0]), "caption": "one", "image_url": f"images/001-{ids[0]}.jpg", "sha256": sha(A)}
    assert photos[1]["image_url"] == BAD and photos[1]["sha256"] == "k" * 64  # link kept on failure
    assert "image_url" not in photos[2]
    assert str(ids[1]) in zf.read("export-warnings.txt").decode()

    text = zf.read("captions.csv").decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(text)))
    assert rows[0] == ["id", "caption", "image_file", "sha256"]
    assert len(rows) == 4


def test_gallery_export_saves_new_hashes_only_for_editors():
    db, _ = gallery_db()
    run(gallery.export_gallery_zip(user=ADMIN, db=db))
    assert len(db.gallery_photos.bulk) == 1 and len(db.gallery_photos.bulk[0]) == 1  # only photo A was unhashed

    db2, _ = gallery_db()
    run(gallery.export_gallery_zip(user=VIEW_ONLY_GALLERY, db=db2))
    assert db2.gallery_photos.bulk == []  # a view-only user's export never writes


def test_gallery_export_is_refused_while_another_export_runs():
    db, _ = gallery_db()

    async def go():
        async with im.single_export():
            with pytest.raises(HTTPException) as exc:
                await gallery.export_gallery_zip(user=ADMIN, db=db)
            return exc.value.status_code

    assert run(go()) == 429


# ── programmes export ──────────────────────────────────────────────────────


def programmes_db():
    return FakeDB(
        programmes=[
            {
                "_id": 1,
                "slug": "wash",
                "num": "01",
                "icon": "droplet",
                "title": "WASH",
                "teaser": "<p>t</p>",
                "body": "<p>b</p>",
                "images": [
                    {"id": "p1", "caption": "first", "image_url": A},
                    {"id": "p2", "caption": "same file again", "image_url": A},  # shared url
                    {"id": "p3", "caption": "png", "image_url": B, "sha256": sha(B)},  # already hashed
                    {"id": "p4", "caption": "gone", "image_url": BAD},
                    {"id": "p5", "caption": "slot only"},
                ],
            }
        ]
    )


def test_programmes_export_contents():
    db = programmes_db()

    async def go():
        return await read_zip(await programmes.export_programmes_zip(user=ADMIN, db=db))

    zf = run(go())
    names = set(zf.namelist())
    assert {"images/wash/01-p1.jpg", "images/wash/02-p2.jpg", "images/wash/03-p3.png"} <= names
    assert zf.read("images/wash/01-p1.jpg") == zf.read("images/wash/02-p2.jpg") == A.encode()
    assert {"programmes.json", "captions.csv", "export-warnings.txt"} <= names

    prog = json.loads(zf.read("programmes.json"))[0]
    assert [i["id"] for i in prog["images"]] == ["p1", "p2", "p3", "p4", "p5"]  # order preserved
    assert prog["images"][0]["sha256"] == prog["images"][1]["sha256"] == sha(A)
    assert prog["images"][3]["image_url"] == BAD  # link kept
    assert "image_url" not in prog["images"][4]

    rows = list(csv.reader(io.StringIO(zf.read("captions.csv").decode("utf-8-sig"))))
    assert rows[0] == ["slug", "image_id", "caption", "programme_title", "image_file", "sha256"]
    assert len(rows) == 6


def test_programmes_export_hash_writes_are_batched_and_permission_gated():
    db = programmes_db()
    run(programmes.export_programmes_zip(user=ADMIN, db=db))
    assert len(db.programmes.bulk) == 1
    assert len(db.programmes.bulk[0]) == 2  # p1 and p2 were unhashed; p3 already matched

    db2 = programmes_db()
    run(programmes.export_programmes_zip(user=VIEW_ONLY_PROGRAMMES, db=db2))
    assert db2.programmes.bulk == []


# ── /api/admin/images/lookup ───────────────────────────────────────────────


def test_lookup_returns_known_urls_and_pending(monkeypatch):
    async def fake_ensure(db):
        return 3

    monkeypatch.setattr(media, "ensure_hashes", fake_ensure)
    db = FakeDB(
        programmes=[{"_id": 1, "images": [{"id": "a", "image_url": A, "sha256": sha(A)}]}],
        gallery_photos=[{"_id": 2, "image_url": B, "sha256": sha(B)}],
    )
    body = media.LookupBody(hashes=[sha(A).upper(), sha(B), "not-a-hash", sha("nope")])
    res = run(media.lookup_images(body=body, user=ADMIN, db=db))
    assert res == {"known": {sha(A): A, sha(B): B}, "pending": 3}


def test_lookup_with_no_valid_hashes_skips_the_backfill(monkeypatch):
    async def boom(db):
        raise AssertionError("backfill must not run")

    monkeypatch.setattr(media, "ensure_hashes", boom)
    res = run(media.lookup_images(body=media.LookupBody(hashes=["zzz"]), user=ADMIN, db=FakeDB()))
    assert res == {"known": {}, "pending": 0}


def test_lookup_requires_edit_access_to_programmes_or_gallery():
    with pytest.raises(HTTPException) as exc:
        run(media.lookup_images(body=media.LookupBody(hashes=[sha(A)]), user=VIEW_ONLY_GALLERY, db=FakeDB()))
    assert exc.value.status_code == 403
