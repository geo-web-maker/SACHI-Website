Gallery import sample (ZIP: captions + images)
Admin > Gallery > "Import captions" > choose this ZIP.
captions.csv columns:
  id       blank = create a NEW photo. To update an existing photo, put its real id here
           (get ids from "Export captions").
  caption  the caption text.
  image    optional: path inside the ZIP (images/x.jpg, uploaded to Cloudinary) or an https:// URL.
           Blank on an existing id = keep the current picture.
