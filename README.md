# Write-Hand

Draw your handwriting in the browser and download it as a real font.

Every character gets a box you write in directly. A sentence at the top re-renders in your font as you draw, with the letters you haven't drawn yet highlighted. When the Required set is done, you download an `.otf` (or a `.woff2` for the web). Everything runs in your browser: there is no server-side processing and nothing is uploaded.

> v1 (a Flask wrapper around the `handwrite` CLI: print a template, photograph it, upload it) is tagged `v1.0`. v2 replaces it entirely.

## What you get

- **Fonts from pen strokes, not photos.** Each stroke keeps its points, pressure and timing. Outlines are built as vectors: perfect-freehand stroke shapes → Clipper2 union → Schneider cubic fit.
- **Pen styles:** fineliner, marker and brush, plus a weight setting. Strokes are kept, so changing the pen rebuilds every glyph.
- **Pressure:** real pen pressure (Apple Pencil, S Pen, Wacom), simulated from speed for mouse and finger, and synthetic curves for tests.
- **Spacing and kerning:** optical sidebearings from edge profiles, plus auto-kerning of outlier pairs (To, Ty, f.), written as GPOS class kerning.
- **Alternates that cycle:** draw second and third forms of e a o t n s i r l d. Repeated letters cycle through them (`calt`), so "hello" doesn't use the same `l` twice. `ss01` turns this off.
- **Ligatures:** ff fi fl ll tt th oo ee (`liga`).
- **Accents:** draw seven marks once and get 54 accented Western European letters (é ñ ü ç å …), plus ß Æ Ø Œ ¿ ¡ « » € £.
- **Test strip:** shapes text with HarfBuzz and highlights where alternates and ligatures fired.
- **Works offline and installs as an app** (PWA) on iPad, iPhone, Android and desktop.

## Using it

| Device | Drawing |
|---|---|
| Desktop | Draw in each box with the mouse or trackpad. Right-click a box for Undo / Clear / large editor. |
| Tablet + pen | The pen draws in the boxes. Once a pen is seen, fingers scroll and tap to open the large editor. |
| Tablet, finger only | Fingers draw in the boxes (settings ⚙ → Finger can switch this). |
| Phone | Tap a box to open the large editor; swipe to scroll. |

Long-press a box (about half a second, without moving) to open its menu. Ctrl/⌘+Z undoes the last stroke in the focused box; Delete clears it.

**Your drawing lives only in this browser.** Clearing site data, or (in Safari tabs) not visiting for a week, erases it. **Export → Save project file** keeps a backup you can open again on any device. Installing the app to the Home Screen also protects it on iOS.

## Development

Requires Node 22.12+ and npm. `uv` (for the font sanitizer) and Docker (for WebKit e2e and the image) are optional.

```sh
npm ci
npm run dev          # http://localhost:5173
npm run lab          # /lab/: stroke recorder + pen-style comparison (dev only)
npm test             # unit + font integration tests (Vitest, HarfBuzz)
npm run check        # svelte-check / TypeScript
npm run verify       # build fixture fonts, run OTS (the browsers' font sanitizer) on each
npm run e2e:local    # Playwright: desktop + Pixel 7 (Chromium) + lab
npm run e2e          # full matrix incl. iPhone 15 / iPad (WebKit) in the Playwright Docker image
PW_BASE_URL=http://127.0.0.1:8340 npm run e2e   # same, against a built image (./manage.fish 3)
```

`./manage.fish` builds, tests and deploys the Docker image: see [CICD.md](CICD.md).

### How it fits together

```
src/
  App.svelte                    header, preview, tiers, grid, dialogs
  components/                   DrawCell, DrawSurface, CellMenu, WriteView, Preview,
                                TierChips, TestStrip, ExportDialog, Onboarding, …
  lib/model/                    metrics (font units, UPM 1000), charset tiers, project schema
  lib/input/                    pointer capture, long-press, the pen/finger input rule
  lib/engines/                  vector outline engine (B), pressure sources, perfect-freehand
  lib/geom/                     Clipper2 union, Schneider fit, winding
  lib/font/                     assemble → spacing, kerning, accents → opentype.js CFF →
                                sfnt.ts splices in hand-serialized GSUB (calt/liga/ss01) + GPOS (kern)
  lib/worker/                   font builds and WOFF2 compression off the main thread
  lib/preview/                  FontFace swap loop, sentences
  lib/store/                    IndexedDB autosave, migration, project files
lab/                            dev-only recorder and comparison page
tests/                          unit/, integration/ (fixture strokes → OTF → HarfBuzz), e2e/
docker/Caddyfile                static file server config (cache headers, CSP)
```

Strokes are stored in font units (baseline y=0), so cells of any size draw at full resolution and resizing never distorts anything. The font is built in a Web Worker 350 ms after you stop drawing; only glyphs whose strokes changed are re-outlined. The result is swapped into `document.fonts` for the live preview.

The plan this was built from is in [docs/v2-plan.md](docs/v2-plan.md). Gate 1 compared three outline engines in the lab: fontify's raster trace (A), trace with pressure (A′) and vector (B). B won. A and A′ remain in git history at the P0 commit.

## Credits

- **[fontify](https://github.com/alexkroeker177/fontify)** by Alexander Kroeker (MIT): the draw-in-every-box UI, the debounce → FontFace preview loop, pointer capture and point filtering, and the winding fix. Ported pieces carry a credit comment.
- [perfect-freehand](https://github.com/steveruizok/perfect-freehand) (MIT), [Clipper2](https://github.com/AngusJohnson/Clipper2) via [clipper2-ts](https://github.com/countertype/clipper2-ts) (Boost), [opentype.js](https://github.com/opentypejs/opentype.js) (MIT), [HarfBuzz](https://github.com/harfbuzz/harfbuzzjs) (MIT), Google's [woff2](https://github.com/google/woff2) via [woff2-encoder](https://github.com/itskyedo/woff2-encoder) (MIT), [idb-keyval](https://github.com/jakearchibald/idb-keyval) (Apache-2.0), [Space Grotesk](https://fontsource.org/fonts/space-grotesk) (OFL).
- Curve fitting follows Philip J. Schneider, "An Algorithm for Automatically Fitting Digitized Curves", *Graphics Gems* (1990).
- `AshFont` (tests/fixtures), a font made with Write-Hand v1, is the sfnt test fixture. Made for a friend.
