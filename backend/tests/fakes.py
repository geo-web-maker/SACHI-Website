"""Tiny in-memory stand-ins for the Motor collections the image code touches.

Only the query shapes used by ensure_hashes / lookup / export are supported:
  {}                                  -> everything
  {"field": {"$in": [...]}}           -> doc.get(field) in list (missing counts as None)
  {"field": {"$nin": [...]}}          -> doc.get(field) not in list
  dotted keys ("images.sha256")       -> ignored (the code under test re-filters)
"""


class FakeCursor:
    def __init__(self, docs):
        self.docs = list(docs)

    def sort(self, *_args, **_kwargs):
        return self

    async def to_list(self, length=None):
        return list(self.docs)

    def __aiter__(self):
        async def gen():
            for d in self.docs:
                yield d

        return gen()


class FakeCollection:
    def __init__(self, docs=()):
        self.docs = [dict(d) for d in docs]
        self.bulk = []  # list of op-lists passed to bulk_write
        self.updates = []  # (filter, update, array_filters) passed to update_one

    def find(self, query=None, projection=None):
        out = []
        for d in self.docs:
            ok = True
            for key, cond in (query or {}).items():
                if "." in key:
                    continue
                if "$in" in cond and d.get(key) not in cond["$in"]:
                    ok = False
                if "$nin" in cond and d.get(key) in cond["$nin"]:
                    ok = False
            if ok:
                out.append(d)
        return FakeCursor(out)

    async def update_one(self, flt, update, array_filters=None):
        self.updates.append((flt, update, array_filters))
        doc = next(d for d in self.docs if d["_id"] == flt["_id"])
        for key, value in update["$set"].items():
            if "$[img]" in key:
                image_id = array_filters[0]["img.id"]
                for img in doc["images"]:
                    if img["id"] == image_id:
                        img["sha256"] = value
            else:
                doc[key] = value

    async def bulk_write(self, ops, ordered=True):
        self.bulk.append(list(ops))


class FakeDB:
    def __init__(self, programmes=(), gallery_photos=()):
        self.programmes = FakeCollection(programmes)
        self.gallery_photos = FakeCollection(gallery_photos)
