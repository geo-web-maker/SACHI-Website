# SACHI Backend (FastAPI + Motor/MongoDB)

## Layout

```
app/
  main.py            FastAPI app, CORS, router registration
  deps.py            get_current_user / require_view / require_edit — server-side access checks
  core/
    config.py        Settings (env vars)
    database.py      Motor client + index setup
    security.py      password hashing + JWT
  models/
    common.py        PyObjectId + ASSIGNABLE_SECTIONS + user_has_access() (mirrors src/admin/data/sections.js)
    programme.py / job.py / gallery.py / contact.py / donation.py / admin_user.py
  routers/
    auth.py           /api/auth/login /logout /me
    programmes.py      /api/programmes, /api/admin/programmes
    jobs.py             /api/jobs (public, filtered), /api/admin/jobs
    gallery.py          /api/gallery, /api/admin/gallery
    contact.py           /api/contact, /api/admin/contact
    donations.py          /api/donations, /api/admin/donations(/stats)
    admin_users.py         /api/admin/users (super_admin only)
    dashboard.py            /api/admin/dashboard/stats
  seed.py              one-off script to migrate the JS mock data into Mongo
```

## Local setup

```bash
cd sachi-backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then edit MONGO_URI / JWT_SECRET
python -m app.seed          # creates the first super_admin + migrates mock data once
uvicorn app.main:app --reload --port 8000
```

If you're upgrading from the old role-based version, also run the one-off
migration once against your live database (back it up first):
```
python -m scripts.migrate_role_to_permissions
```

Docs at http://localhost:8000/docs once running.

## How auth works

- `POST /api/auth/login` checks the password against the bcrypt hash stored on
  the `admin_users` doc, then sets a JWT in an **httpOnly cookie** (`sachi_session`).
  No JS on the frontend ever touches the token directly — same pattern as Almanac.
- Every admin route depends on `require_view("<section>")` or `require_edit("<section>")`,
  which decodes the cookie, loads the user, and checks either `is_super_admin` or their
  own `permissions[section].view` / `.edit` grant (`app/models/common.py`). Access is
  scope-based and per-user — set individually by a super_admin via `/api/admin/users`,
  not derived from a fixed role. `ASSIGNABLE_SECTIONS` is a hand-kept mirror of the
  frontend's `src/admin/data/sections.js` — if you add a section there, add it here too.
- `require_super_admin` is used on `/api/admin/users` since only a super_admin
  should manage other admins' access.

## Notes / things intentionally left as stubs

- **Gallery uploads**: `image_url` is just a string field for now. Wire up
  Cloudflare R2 (like the Mood Foam Mattresses project) when ready, and have
  the admin form PUT the file directly to R2, then send the resulting URL here.
- **Donations**: `/api/donations` records intent only — no payment gateway is
  called yet. Swap in a Pesapal/Flutterwave confirmation webhook before treating
  a row here as a completed transaction.
- **Admin user creation**: `POST /api/admin/users` takes a plaintext temp
  password directly. If SACHI wants an invite-link flow later, that's the
  same pattern used on the Almanac project already.
