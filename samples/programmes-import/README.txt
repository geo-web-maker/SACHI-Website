SACHI programme import sample (ZIP)
===================================
Import: Admin > Programmes > "↑ Import" > choose this ZIP.

Layout
  programmes.json          required, at the ZIP root (or one folder deep)
  images/*.jpg             photos referenced by image_url

Rules the importer follows
  * Programmes are matched by slug: existing slug = UPDATED (title, icon, teaser, body AND the whole
    images list are overwritten); new slug = CREATED with the next number.
  * Required per programme: slug, title, icon, and teaser or body.
  * icon must be one of: Search, Droplet, ShieldCheck, HardHat, Wheat, HeartPulse, Stethoscope, Handshake
  * teaser/body are HTML. Only these tags survive on the site: p strong em u ul ol li br h2 h3.
  * images[].id   unique within the programme (convention: <slug>-1, <slug>-2 ...). Order in the array = display order.
  * images[].caption   the photo caption.
  * images[].image_url
      - relative path (images/x.jpg): taken from the ZIP and uploaded to Cloudinary
      - absolute https:// URL: kept as-is
      - omitted: photo slot with caption only, add the picture later in Edit
  * A missing file inside the ZIP is skipped (photo left empty) with a console warning.
Because images are overwritten, to change ONLY captions later use the captions CSV (↑ Captions).

captions.csv (optional)
  Same ZIP may include captions.csv (slug, image_id, caption). Where a caption differs from programmes.json,
  the CSV wins - handy for editing captions in Excel without touching the JSON. The preview shows how many changed.
  The "↓ Export" button now produces exactly this layout (programmes.json + captions.csv + images/<slug>/...),
  with the real picture files inside instead of web links.
