# Brand assets

- `logo-sachi.png` — the SACHI logo, trimmed to its visible edges. Used in
  the site header (`components/Nav`).
- Favicons generated from the same logo live in `/public/`:
  `favicon.png` (32×32), `favicon-48.png`, `favicon-512.png`,
  `apple-touch-icon.png` (180×180, for iOS home-screen icons).

## Where this logo works well
The header background is light (cream), and the logo's blue/white/red/green
reads clearly on it — no contrast issues there.

## Where a different logo variant may be needed later
This is a single-color-background logo (opaque blue oval). If you later add
a dark-background section that needs a logo — e.g. a dark footer, a donation
banner, printed letterhead — this exact file may not sit well if that
background color is close to the logo's blue. If that comes up, the fix is
usually one of:
- A version with a white/transparent ring or padding around the oval, so it
  sits on any background.
- A reversed/white-only version (logomark in white line art) for very dark
  or busy backgrounds.

None of the current pages need this yet — flagging it so it's not a surprise
if a future dark-background placement needs a second file.
