# Static images (hero + our model)

These images are committed straight into the repo and served as plain static
files — no backend, no Cloudinary, no database. To update a photo, just
overwrite the file at the same path (keep the same filename and extension)
and push to GitHub; the next deploy picks it up automatically.

## /images/hero/
One image per programme, shown in the homepage hero slideshow.
Recommended: square-ish, at least 1200×1200px, JPG.

**Status:**
- `participatory-action-research.jpg` — real photo ✅
- `disease-prevention-control.jpg` — real photo ✅
- `occupational-health-safety.jpg` — real photo ✅
- `nutrition-food-security.jpg` — real photo ✅
- `sexual-reproductive-health.jpg` — real photo ✅
- `health-care-disease-prevention.jpg` — real photo ✅
- `livelihood-vulnerable.jpg` — real photo ✅
- `wash-environmental-health.svg` — still a placeholder. None of the photos
  supplied so far show WASH activity specifically (borehole, handwashing,
  latrines, water points) — send one when available and it'll slot straight
  in as `wash-environmental-health.jpg`.

Wired up in `src/data/programmes.js` via each programme's `heroImage` field.

| File | Programme |
|---|---|
| participatory-action-research.jpg | Participatory Action Research |
| wash-environmental-health.svg | WASH and Environmental Health |
| disease-prevention-control.jpg | Disease Prevention & Control |
| occupational-health-safety.jpg | Occupational Health & Safety |
| nutrition-food-security.jpg | Nutrition and Food Security |
| sexual-reproductive-health.jpg | Sexual and Reproductive Health |
| health-care-disease-prevention.jpg | Health Care and Disease Prevention |
| livelihood-vulnerable.jpg | Livelihood Programme for the Vulnerable |

## /images/model/
Images shown as a slideshow in each "Our Model" pillar row.
Recommended: 4:3-ish ratio, at least 1000px wide, JPG.

**Status — all pillars now have real photos ✅**
- `community-led-1.jpg` — real photo. Only one photo supplied so far, so
  there's no second slot in the code right now (no placeholder file sitting
  unused). When you have a second community-led photo, add it as
  `community-led-2.jpg` and add a matching entry back into `modelPillars.js`.
- `pdd-1.jpg`, `pdd-2.jpg` — real photos
- `gender-1.jpg`, `gender-2.jpg`, `gender-3.jpg` — real photos (3 photos
  used here since all three fit the pillar's copy — farming, planting, fish)
- `vulnerable-1.jpg`, `vulnerable-2.jpg`, `vulnerable-3.jpg` — real photos
- `collaborated-1.jpg`, `collaborated-2.jpg` — real photos

Wired up in `src/data/modelPillars.js` via each image's `image_url` field.

## Replacing a placeholder with a real photo
1. Drop your photo into the matching folder.
2. If you're using a `.jpg`/`.png` instead of `.svg`, update the file
   extension in `programmes.js` (`heroImage`) or `modelPillars.js`
   (`image_url`) to match.
3. Commit and push — Vercel redeploys automatically.
