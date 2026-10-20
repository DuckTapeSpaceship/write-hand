# Write-Hand v2.0: draw-in-browser handwriting font maker

> 🟡 **= changed in revision 2** (after your plan comments). Search for 🟡 to find every edit.
> 🟢 **= changed in revision 3.** Search for 🟢.
>
> **Revision 3 changes at a glance**
> 1. 🟢 Accent is now **Dracula yellow `#f1fa8c`** (a highlighter), not pink. Blue was considered: see Theme.
> 2. 🟢 Android is a first-class PWA target alongside iOS.
> 3. 🟢 New **Responsive layout** section: phone, tablet and desktop. Cells stay large and easy to write in, and touch scrolling doesn't fight drawing.
> 4. 🟢 HTTPS note removed: the site will be on a public domain.
>
> **Revision 2 changes at a glance**
> 1. 🟡 No new branch. Tag the current commit `v1.0` and replace the code on `main`.
> 2. 🟡 Framework: Svelte is kept and justified for an iPad PWA. Added an iOS PWA checklist.
> 3. 🟡 Outlines: engine A is fontify's pipeline **as-is**. Pressure is tested in software (simulated and synthetic), since there's no pen device to hand.
> 4. 🟡 Cell clear and undo: visible ×, right-click menu, long-press menu.
> 5. 🟡 Hosting rewritten: **Docker image + compose on `:latest`**, built and pushed by `manage.fish` like Isai. **No Forgejo runner and no CI.** It stays serverless: the container only serves static files.
> 6. 🟡 New **Theme** section: tactile/retro, hard outlines and shadows, 5px radius, your bg/fg colours, Dracula palette led by a pink accent.
> 7. 🟡 Handoff: this session doesn't execute. The plan is saved to disk with a kickoff prompt for a new session.

## Context

v1 is a Flask app that wraps the `handwrite` CLI (print template → photo → upload → TTF). The previous session's review found real problems with it: fonts are stored under user-chosen names (collisions and other users can download them), `debug=True` on 0.0.0.0, orphaned outputs, a 5 MB limit too small for phone photos, and unpinned deps. It then designed a replacement. You draw on screen, everything runs in the browser, and fonts are built from **pen strokes, not images**. That design had optional alternates and ligatures, a public audience, and milestones M0–M4.

You want v2.0 to be **one release containing all of M0–M4**, built on the **fontify** mechanism (github.com/alexkroeker177/fontify, MIT). Fontify shows every character as a box you draw in directly, with a sticky editable sentence on top that re-renders in your font as you draw.

### Fontify vs. our design: what we take
I read fontify's source (`App.tsx`, `DrawCell.tsx`, `fontBuilder.ts`, `persistence.ts`, `glyphs.ts`).

- **Take: the UX shell and preview loop.** These beat our earlier "grid → tap to open editor" idea. On each stroke change the app waits 350 ms, then builds the full OTF and wraps it in `new FontFace('Preview', buf)`. It then swaps the old face out of `document.fonts`, puts the new one in, and the preview `<div>` sets `font-family: 'Preview'`. Characters you haven't drawn fall back to the system font. Fontify also caches each glyph by its stroke array, so only the glyph that changed is rebuilt.
- **Improve on it:**
  - Fontify builds on the main thread. We build in a Web Worker.
  - Fontify uses a fixed-width pen and spaces glyphs from their bounding box only. We add pressure, kerning, alternates, ligatures and accents.
  - Fontify saves to localStorage, which runs out of room once points carry pressure and time. We use IndexedDB.
  - Fontify's sentence doesn't show which letters are still missing. Ours does.
  - Fontify only clears a whole cell. 🟡 We add undo of the last stroke and a cell menu.
- **Undecided: the outline method.** Fontify's raster+trace and our vector method go head to head in Phase 0.

## Decisions
- 🟡 **Framework: Svelte 5 + TypeScript + Vite + `vite-plugin-pwa`.** PWA quality on an iPad comes from the manifest, the service worker and iOS-specific handling, not from the framework. Svelte has the smallest runtime, which means a faster cold start in standalone mode, and it adds no work in a canvas-heavy app. Package manager: npm (node 26 is installed).
- 🟡 **Repo:** the next session first runs `git tag -a v1.0 -m "v1.0: Flask + handwrite"` on the current HEAD, then replaces the code **on `main`** (no branch).
- 🟡 **Outlines:** build fontify's engine **exactly as it is** (A), plus our vector engine (B) and a pressure variant (A′). Compare them in the lab page and pick one, or keep both as pen styles.
- 🟡 **Hosting:** Docker image + compose, like Isai (details below). **No runner needed.**

## Architecture

```
index.html                 app entry (Vite)
lab/index.html             dev-only engine comparison + stroke recorder (not in the image)
src/
  App.svelte               single surface: name, progress, export, Preview, tier chips, grids
  components/
    Preview.svelte         fontify sentence mechanism + missing-glyph highlighting + presets + feature toggles
    TierChips.svelte       Required / Recommended / Alternates / Ligatures / Accents, with done/total counts
    GlyphGrid.svelte, DrawCell.svelte   draw directly in each box (fontify), with guides
    🟡 CellMenu.svelte      Undo stroke / Clear / Open large editor (right-click or long-press)
    🟢 WriteView.svelte     large canvas with prev/next, ghost neighbours, x-height drag (full screen on phones, modal on desktop)
    TestStrip.svelte       HarfBuzz-shaped text; highlights where alternates and ligatures fired
    ExportDialog.svelte    OTF/WOFF2, project export/import, install steps per OS, iPad note
    Onboarding.svelte, Landing.svelte, 🟡 ThemeToggle.svelte
  🟡 styles/tokens.css     theme tokens (see Theme)
  lib/model/    project.ts (schema v2), charset.ts (tiers + slot ids), metrics.ts
  lib/input/    pointer.ts: getCoalescedEvents when available, pressure, palm rejection once a pen is seen, 🟡 long-press detection
  lib/engines/  types.ts (OutlineEngine), trace.ts (A/A′), vector.ts (B), 🟡 pressure.ts (real / simulated / synthetic)
  lib/geom/     union.ts (Clipper2 port), fit.ts (Schneider fit), winding.ts (taken from fontify's orient/signedArea)
  lib/font/     build.ts, spacing.ts, kerning.ts, compose.ts (accented letters),
                gsub.ts (calt/liga/ss01), gpos.ts (kern), sfnt.ts (table splicer), woff2.ts
  lib/worker/   build.worker.ts + client.ts (debounce, transfer ArrayBuffer, drop stale results)
  lib/preview/  fontface.ts (swap face in document.fonts), sentences.ts
  lib/store/    idb.ts (idb-keyval), persist.ts (navigator.storage.persist), migrate.ts, file.ts (.writehand.json)
public/         AshFont.ttf (landing demo), duct.png, icons, manifest
tests/          unit/, fixtures/strokes/*.json, e2e/
🟡 Dockerfile, docker-compose.yml, docker/Caddyfile, .dockerignore
🟡 manage.fish, deploy.conf.example, CICD.md
```

**Data model.** One "slot" per thing to draw:

```ts
type Slot = {
  id: string;            // 'a', 'a.alt1', 'f_f', 'mark.acute'
  kind: 'base' | 'alt' | 'liga' | 'mark';
  unicode?: number;
  strokes: Stroke[];
  rev: number;
}
type Stroke = { pts: number[]; pointer: 'pen' | 'touch' | 'mouse' }   // pts is flat [x, y, pressure, t, ...]
```

- Coordinates are **font units** (UPM 1000, baseline y=0). The cell canvas maps screen pixels to these units, so the guides line up with the font metrics.
- The project stores `{schema: 2, name, metrics, pen, slots, sample}`.

**OutlineEngine interface:** `outline(strokes, pen) → Contour[]` in font units, with correct winding. The cache key is `slot.id + rev + pen + engine`.
- 🟡 **A, fontify as-is:** a port of fontify's `fontBuilder.ts` `trace()` and `traceGlyph()`. It uses the same `PEN`, the same 480 px raster, the same imagetracerjs options and the same `orient()`. Only the coordinate mapping changes, to our font-unit space.
- **A′, trace + pressure:** perfect-freehand polygons rasterized, then traced. This variant isolates the pen effect from the tracing effect.
- **B, vector (our design):** perfect-freehand → Clipper2 union → Schneider cubic fit → winding fix.

🟡 **Pressure without a pressure device.** `pressure.ts` picks between three sources:
- **real:** a pen reports `pressure`.
- **simulated:** perfect-freehand's `simulatePressure` thins the line as you move faster. This is the default for mouse and finger, so it's what you'll see day to day.
- **synthetic:** a deterministic curve (taper in and out, or a sine wave) used for fixtures and tests.

The lab page has a recorder: draw with the mouse, save as JSON, then add a synthetic pressure curve. Playwright sends real `PointerEvent`s with `pointerType:'pen'` and changing `pressure`. A test on a real Apple Pencil is a manual pre-release item for later.

**Font build (worker):**
1. Outline the slots that changed.
2. Set sidebearings from each glyph's width.
3. Auto-kern: compare the facing edge profiles of each pair at several heights.
4. Compose accented letters: put the base and mark outlines together, with the mark centred on the base's top or bottom.
5. Build `.notdef` and `space`.
6. opentype.js writes a CFF OTF.
7. `sfnt.ts` replaces GSUB and GPOS with tables we serialize ourselves, then recomputes the checksums and `head.checkSumAdjustment`.

This avoids depending on whether opentype.js can write chaining contextual lookups (GSUB type 6) or GPOS kerning. Nothing I found confirms that the main opentype.js release can write these tables.

**OpenType features:**
- `calt` cycles alternates. A chained rule picks `X.alt1` after `X`, `X.alt2` after `X.alt1`, and so on, looking back up to 3 glyphs.
- `liga` covers drawn ligatures.
- `ss01` turns cycling off.
- `kern` is GPOS PairPos format 2 (class-based).
- The browser preview applies `calt` and `liga` by default, so the live sentence already shows alternates and ligatures.

**Live sentence (fontify mechanism, extended):**
- The sentence is editable. Presets: pangram, "hello lilly" (shows alternates), a numbers-and-punctuation line.
- **Auto mode** picks a sentence that mostly uses letters you've drawn.
- Characters without a drawn slot are wrapped in `.missing` spans: dimmed fallback font with a 🟢 yellow highlighter background. Tapping one scrolls to and focuses that cell (🟢 on a phone it opens that slot in the write view).
- Toggles for `calt`, `liga` and `ss01` set `font-feature-settings`.

🟡 **Cell clear / undo (DrawCell + CellMenu):**
- **Visible ×** on filled cells. It clears the cell and is ≥32 px on coarse pointers. After a clear, a 5 s toast offers **Undo**, since a stray tap could otherwise wipe a glyph.
- **Right-click** anywhere on a cell opens the CellMenu: *Undo last stroke · Clear cell · Open large editor*. The browser context menu is suppressed.
- **Long-press:** hold 550 ms with less than 6 px movement and no pen lift. The in-progress dot is discarded and the menu opens.
  - A normal tap is much shorter, so the dots on i, j, `.` and `!` still draw.
  - The cell label strip also opens the menu on any press.
  - iOS needs `-webkit-touch-callout:none`, `user-select:none` and `touch-action:none` on cells, or Safari's magnifier and callout fire first.
- **Keyboard:** Ctrl/⌘+Z undoes the last stroke in the focused cell, and Delete clears it. Cells can be focused with Tab.

## 🟢 Responsive layout: phone, tablet, desktop
Goal: every writing surface is big enough to write in comfortably, and scrolling never fights drawing. That conflict is fontify's weak spot: with `touch-action:none` on every cell, a finger can't scroll a page full of cells.

**Input rule (`lib/input/mode.ts`):**
- **Mouse or trackpad:** draw directly in grid cells.
- **Pen** (Apple Pencil, S Pen, Wacom): the pen draws in grid cells and fingers scroll. Once a pen has been seen, cells set `touch-action: pan-y` and ignore `pointerType:'touch'` (this is also the palm rejection). Finger drawing comes back via a toggle.
- **Finger only on a phone:** the grid is **tap to open**, so scrolling works normally. A tap opens the **write view**.
- **Finger only on a tablet:** draw in grid cells by default, with scrolling from the gutters and the sticky chip bar. A setting "Finger: draw in grid / open write view" lets you choose.

**Write view (`WriteView.svelte`, which replaces the GlyphEditor modal on small screens):**
- A large square canvas, about `min(92vw, 70vh)`.
- Guides, plus ghost neighbours either side.
- **Prev / Next** buttons, so you can work through a tier quickly, and keyboard ←/→ on desktop.
- Undo stroke, Clear, Done.
- A one-line live preview strip pinned above the canvas, so the sentence still updates as you write.

**Breakpoints (container queries on the grid):**

| Size | Grid | Cell size | Header / preview |
|---|---|---|---|
| Phone (< 600px) | 2–3 columns | ≥ 140px | Compact sticky bar: name, progress, Export. The preview is one line that expands on tap and collapses while scrolling, capped at 20% of the viewport. |
| Tablet (600–1100px) | 3–5 columns | ≥ 170px | Sticky preview of 2 lines at 40px text. Chips scroll sideways. |
| Desktop (> 1100px) | 5–8 columns, max width 1280px | ≥ 160px | Full header as in fontify. The write view opens as a large modal. |

- Cells use `grid-template-columns: repeat(auto-fill, minmax(var(--cell-min), 1fr))`. A **Cell size S/M/L** setting changes `--cell-min`.
- Canvases are drawn at the device pixel ratio and redraw on resize (ResizeObserver). Strokes are stored in font units, so resizing never distorts glyphs.
- Safe-area insets apply. Landscape phones get the write view with the preview on the side.

## 🟡 Theme: tactile / retro buttons
- **Surfaces:**
  - **One flat background everywhere.** The page, header, panels, cells and modals all share `--bg`. Regions are separated by outlines and shadows, not by colour.
  - **Borders:** `2px solid var(--fg)`. **Radius:** `5px` on everything.
  - **Shadows:** hard, no blur: `box-shadow: 4px 4px 0 0 var(--fg)`.
  - **Buttons:** on hover they lift (`translate(-1px,-1px)`, 5px shadow). When pressed they sink (`translate(4px,4px)`, shadow 0). This gives a physical button click.
- **Tokens (`styles/tokens.css`):**

  | Token | Dark | Light |
  |---|---|---|
  | `--bg` | `#1e1f29` | `#c0caf5` |
  | `--fg` (text, outlines, shadows, ink) | `#c0caf5` | `#1e1f29` |
  | `--accent` | 🟢 `#f1fa8c` (Dracula yellow) | 🟢 `#f1fa8c` |
  | `--on-accent` (text on accent) | `#1e1f29` | `#1e1f29` |

- 🟢 **Why yellow, not blue:** the light background `#c0caf5` is already blue-lavender. A blue accent (Dracula cyan `#8be9fd`, or a deeper blue) would nearly disappear into it in light mode. Yellow is a highlighter colour, which fits a handwriting app. It contrasts with lavender by hue in light mode and pops against `#1e1f29` in dark mode. Cyan stays as a secondary colour (TestStrip).
- **Where the accent goes:**
  - primary buttons (accent fill, `--on-accent` text, fg border and shadow)
  - the shadow on filled cells, which signals "done"
  - the progress bar
  - the active tier chip
  - 🟢 missing glyphs in the sentence get a yellow highlighter *background*, not a thin underline, because a thin yellow line would vanish in light mode
  - 🟢 the focus ring: a 3px `--fg` outline with a 2px yellow offset band, visible in both modes
- **Other Dracula colours, used sparingly as fills or shadows with fg/on-accent text (not as text on `--bg`, which fails contrast in light mode):**
  - green `#50fa7b` for "tier complete"
  - orange `#ffb86c` for "required left"
  - red `#ff5555` for Clear and destructive actions
  - cyan `#8be9fd` and 🟢 pink `#ff79c6` for the TestStrip highlights (alternate and ligature)
  - comment `#6272a4` for the dashed drawing guides
- **Theme selection:** dark mode is the default and follows `prefers-color-scheme`. A manual toggle sets `data-theme` and the choice is remembered in localStorage.
- **Type:** a bundled self-hosted UI font (`@fontsource/space-grotesk`), so nothing loads from Google Fonts and the app works offline.

## Phases (all ship together as v2.0)

**P0: scaffold + spikes (decision gates)**
- Tag `v1.0`. Remove `app.py`, `templates/`, `template.jpg`, `static/Hw.jpg` and `requirements.txt`, and replace the Python `.gitignore` with a Node one.
- Set up Vite + Svelte + TS + Vitest + Playwright, and the theme tokens.
- Build engines A, A′ and B, plus `lab/index.html`:
  - a stroke recorder and the synthetic pressure picker
  - the same strokes rendered by each engine side by side at 16, 48 and 200 px, with node count and build time
- **Gate 1:** you pick the engine by eye.
- `sfnt.ts` and `gsub.ts` spike: shape "hello" with harfbuzzjs and assert it produces `l, l.alt1`.
- 🟡 OTS check as a local script: `npm run verify` runs `uvx --from opentype-sanitizer ots-sanitize` on built fixture fonts (uv is installed).
- **Gate 2:** cycling works and OTS accepts the font.

**P1: core (fontify parity, plus our improvements)**
- Tiered slots. Required: a–z, A–Z, 0–9, `. , ' ? !`. Recommended: the remaining keyboard punctuation.
- DrawCell with guides, 🟡 CellMenu, undo and clear.
- 🟢 The input-mode rule, plus a basic WriteView, so phones can tap a cell to write.
- Worker build loop, FontFace preview and the sentence features above.
- IndexedDB autosave with a persistent-storage request.
- OTF download, enabled once the Required tier is complete. Before that, a "N required left" hint shows.

**P2: quality**
- Spacing and auto-kerning.
- Pen styles (fineliner, marker, brush), which need engine B or A′.
- 🟢 WriteView (prev/next, ghost neighbours, adjustable x-height) and the responsive breakpoints. 🟢 Note: the phone tap-to-open path moves to **P1**, so phones work from the start.
- Accent slots composed into Western European accented letters.

**P3: realism**
- Alternate slots for e a o t n s i r l d, plus ligature slots.
- `calt`, `liga` and `ss01`.
- TestStrip with harfbuzzjs (loaded only when opened).

**P4: launch**
- Onboarding.
- Project export and import, and a prompt to export because browser storage can be wiped.
- 🟡 PWA, with the iOS checklist below.
- WOFF2 (wawoff2, loaded only when needed).
- Landing section with AshFont.
- Install instructions per OS, including that iPadOS needs a helper app.
- Accessibility pass.
- README rewrite and `CICD.md`.
- Build and push the image, deploy, then tag `v2.0`.

🟡 **PWA checklist** 🟢 (iOS + Android):
- **Both:**
  - manifest with `display: standalone`
  - 🟢 any-purpose and **maskable** icons at 192 and 512 px
  - `theme_color` and `background_color` set to `#1e1f29`
  - safe-area insets
  - disable pinch and double-tap zoom on the drawing surfaces only
  - service worker with offline precache and an update prompt
  - `navigator.storage.persist()`
- **iOS:**
  - apple-touch-icon and `apple-mobile-web-app-*` metas
  - suppress `-webkit-touch-callout`
  - a manual "Share → Add to Home Screen" hint. Home Screen PWAs keep their storage, unlike Safari tabs, which can be cleared after 7 days without a visit.
- 🟢 **Android:**
  - an Install button driven by `beforeinstallprompt`
  - stop Chrome's pull-to-refresh and overscroll from interrupting strokes (`overscroll-behavior: none` on drawing surfaces)
  - S Pen and USI styluses report `pointerType:'pen'` with pressure, so the pen rule above applies
  - suppress the long-press text-selection and context popups on cells
  - the downloaded OTF installs on most Android phones only with root or a font-manager app, so the export dialog says so

## 🟡 Hosting: Docker + compose, the Isai way (no runner, no CI)
I mirrored Isai's `CICD.md`, `manage.fish`, `deploy.conf.example`, `Dockerfile` and `docker-compose.yml`.

- **Still serverless? Yes.** The container only serves the built static files. It has no app server, no endpoints that accept data and no uploads, and all font building stays in the visitor's browser. Docker only changes how the files are shipped. Hardening:
  - `read_only: true`
  - runs as non-root
  - `cap_drop: [ALL]`
  - `no-new-privileges`
  - tmpfs for Caddy's runtime directories
- **`Dockerfile` (multi-stage):**
  - `node:22-slim` runs `npm ci && npm test && npm run build`, so failing unit tests stop the image build.
  - `caddy:2-alpine` serves `/srv` with `docker/Caddyfile`:
    - `file_server`, `encode zstd gzip`
    - `/assets/*` gets `immutable` with a 1-year cache
    - `index.html`, `sw.js` and `manifest.webmanifest` get `no-cache`
    - `respond /healthz 200`
  - `APP_VERSION` is passed as a build arg (from `git describe`) and shown in the footer.
- **`docker-compose.yml`:** `image: ${IMAGE_REF:-git.ducktapespaceship.xyz/arun/write-hand}:${IMAGE_TAG:-latest}`, `restart: unless-stopped`, `ports: "${PORT:-8340}:80"`, plus a healthcheck (`wget -qO- localhost/healthz`) and the hardening above. **No volumes:** user data lives in each browser.
- **`manage.fish`** is a copy of Isai's script with the Python and audio parts removed. Menu:
  1. Build & push (`:latest`, `:<sha>`, `:vX.Y.Z` on a tag)
  2. Local dev (`npm run dev`)
  3. Local image test (`docker build` + run on `:8340`)
  4. Deploy config
  5. Deploy (scp the compose file, then `docker compose pull && up -d` over SSH)
  6. **Ship:** `git push` → build & push → deploy. This is how "push also builds the image" works without a runner.
  7. Logs
  8. Registry login
  9. Status
- `deploy.conf` is gitignored and lists `REGISTRY`, `IMAGE_OWNER`, `IMAGE_NAME`, `IMAGE_TAG=latest`, `DEPLOY_HOST` (your Caddy + cloudflared box) and `DEPLOY_DIR`.
- **Front door:** the host Caddy runs `reverse_proxy localhost:8340`, and the cloudflared ingress points the hostname at Caddy. `CICD.md` documents both snippets. Cloudflare respects the `no-cache` on `sw.js`, so updates arrive straight away.

## Reuse
- From fontify (MIT; credit in README and in a code comment on ported files):
  - the debounce → FontFace swap loop (`App.tsx`)
  - pointer capture and the minimum-distance point filter (`DrawCell.tsx`)
  - glyph caching by stroke identity, and the winding fix `orient` / `signedArea` / `reverse` (`fontBuilder.ts`)
  - imagetracerjs settings and `trace()`, as engine A (`fontBuilder.ts`)
- 🟡 From Isai (`/home/arun/Projects/Isai`): `manage.fish`, `deploy.conf.example`, the `CICD.md` structure, the compose `IMAGE_REF`/`IMAGE_TAG` pattern and the `.dockerignore` style.
- From v1: `static/AshFont.ttf` and `static/duct.png` move to `public/`.

## Verification
- **Unit (Vitest):** winding and union; GSUB and GPOS serializers round-trip through opentype.js parse; sfnt checksums; kerning; 🟡 long-press vs. tap classification; 🟡 the synthetic pressure curves.
- **Font integration (Vitest in Node, engine B):** fixture strokes → OTF → harfbuzzjs shaping. "hello" uses `l.alt1`. "office" uses `f_f`, or plain `f f` with `liga` off. "é" exists. `npm run verify` checks every font with OTS.
- **E2E (Playwright, Chromium and WebKit, with an iPad device profile for WebKit):**
  - 🟢 Device projects: iPhone 15 (WebKit), iPad Pro 11 (WebKit), Pixel 7 (Chromium) and Desktop 1440 (Chromium). On phones, a finger swipe over the grid scrolls the page and a tap opens the write view. On tablets with a pen, a pen stroke draws while a finger swipe scrolls. Cells must meet the minimum size for each breakpoint.
  - Draw pen strokes with changing pressure in "H", then wait for the preview face. "H" should no longer be `.missing`.
  - 🟡 Right-click → Clear, and long-press → Clear, both empty the cell. Undo restores it. A short tap leaves a dot.
  - Reload: the strokes are restored from IndexedDB.
  - Export the project, clear it, import it again.
  - Download an OTF and re-parse it.
  - 🟡 Screenshots in both themes.
- 🟡 **Image:** `./manage.fish 3`, then `curl -I localhost:8340/` and `/assets/<hash>.js` show the right cache headers, and `/healthz` returns 200. `docker inspect` shows the container is read-only and non-root.
- **Manual:** draw on an iPad 🟢 and an Android phone through the public URL, install it to the Home Screen and check that it works offline. Install the OTF on desktop and type with it.

## 🟡 Handoff (this session doesn't execute)
- Once this plan is approved, this session will:
  - copy it to `docs/v2-plan.md` in the repo, uncommitted, for the new session to read
  - save your "mark plan edits with highlights" rule to `~/.claude/CLAUDE.md`
  - print a kickoff prompt
- The new session works through P0 → P4 and **stops at Gate 1** (the engine comparison) and Gate 2 for your input.
