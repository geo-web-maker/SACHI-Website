Caption import/export samples
-----------------------------
sample-programme-captions.csv  Built from src/data/programmes.js. Columns: slug, image_id, caption.
                               Match is on slug + image_id; only the caption changes.
                               programme_title and image_url are for reference and ignored on import.
sample-gallery-captions.csv    Columns: id, caption. The ids here are PLACEHOLDERS - on your site click
                               "Export captions" in Gallery to get real ids, edit the caption column, re-import.
Tips: keep the header row, don't edit id/slug/image_id, save as CSV UTF-8 in Excel.
