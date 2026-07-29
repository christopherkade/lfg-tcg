# PodFinder marketing assets

Brand kit, demo video, and social assets for PodFinder, generated from the
app's real UI and real theme tokens (`src/app/globals.css`). Everything here
is rebuildable — the scripts are the source of truth, the files in each
`output/` folder are just their latest render.

Rendering works by pointing headless Chrome at a local HTML file
(`--headless --screenshot`) instead of using a design tool, so every asset
stays pixel-consistent with the actual app and is one command away from a
fresh version.

## brand/

`kit.html` — the brand reference sheet: palette (obsidian/ember/spark, pulled
from `globals.css`), type specimen, the 4 game logos, and the "socket"
wordmark signature (the `o` in "Pod" as a plug/socket shape).

To regenerate `output/podmaker-brand-kit.png`:

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --force-device-scale-factor=2 \
  --window-size=1200,1460 --screenshot=brand/output/podmaker-brand-kit.png \
  --virtual-time-budget=2000 "file://$(pwd)/brand/kit.html"
```

Edit `kit.html` directly for copy/color changes, then rerun.

`overview.html` — a light, "at a glance" summary card (1200×630, README/OG-card
size): the mascot (`public/mascot.svg`, inlined) next to the wordmark,
tagline, a 3-step value prop, and the 4 supported games. Unlike `kit.html`,
this one uses the light/paper palette instead of the dark obsidian
background, with emerald as the only accent color.

To regenerate `output/podfinder-overview.png`:

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --force-device-scale-factor=2 \
  --window-size=1200,630 --screenshot=brand/output/podfinder-overview.png \
  --virtual-time-budget=2000 "file://$(pwd)/brand/overview.html"
```

Edit `overview.html` directly for copy/color changes, then rerun. If
`public/mascot.svg` changes, copy its `<g>...</g>` markup back into the
inlined `<svg>` here.

## video/

A 1080×1920 (vertical, Reels/TikTok) walkthrough video assembled from real
screenshots of the app.

- `shotlist.json` — the creative brief: full shot list with French
  voiceover/caption copy. Read this first when re-scripting the video.
- `frames/` — the actual screenshots captured from a live logged-in session
  (login, search, join request, accept, notifications, matched table,
  history). Recapture these via browser automation if the UI changes.
- `clips.json` — the render manifest: for each clip, which frame to use,
  duration, and caption text.
- `caption_template.html` — renders each caption as a PNG bar (Homebrew's
  ffmpeg has no `drawtext`/freetype support, so captions are composited as
  images instead of burned-in text).
- `build.sh` — reads `clips.json`, and for each clip: pads/crops the frame to
  the canvas as a static image (no zoom/pan — screens are just displayed as
  you walk through them), overlays the caption PNG, then concatenates all
  clips into `output/podmaker-walkthrough-all.mp4`.

To rebuild after editing `clips.json` (new captions, durations, or clip
order):

```bash
cd video && ./build.sh
```

To use different frames, capture new screenshots into `frames/` and update
the `file` field of the relevant clip(s) in `clips.json`.

Requires `ffmpeg` (`brew install ffmpeg`) and Google Chrome at the default
`/Applications/Google Chrome.app` path.

## social/

Static image assets for Instagram/TikTok, all rendered from one parametrized
template.

- `template.html` — single template covering 3 sizes (`size=square` 1080×1080
  feed post, `size=portrait` 1080×1350 carousel slide, `size=story`
  1080×1920 story/Reel cover) with slots for eyebrow, title, subtitle, a
  single logo, a row of logos, a numbered step badge, and a footer
  line/CTA — filled in via URL query params.
- `manifest.json` — one entry per asset: which size, and which params to
  pass to the template. Currently: an intro post, a 4-slide "jeux
  supportés" carousel, a 3-slide "comment ça marche" carousel, and a launch
  story.
- `generate.sh` — reads `manifest.json` and renders every entry to
  `output/<name>.png` via headless Chrome.

To regenerate everything after editing `manifest.json` or `template.html`:

```bash
cd social && ./generate.sh
```

To add a new asset: add an entry to `manifest.json` (pick a `size` and the
params the template supports) and rerun — no script changes needed unless
you need a new layout, in which case extend `template.html`'s param
handling.

## Notes

- All copy is in French — PodFinder's own UI copy (`src/lib/i18n/dictionaries/fr.json`)
  is the source of truth for terminology (e.g. "table", not "pod" or "party").
- The video's `frames/shot10_history.jpg` shows a real Discord handle from
  the account used to capture it — check before publishing whether it needs
  blurring.
- Nothing in this folder is wired into the Next.js app; it's a standalone
  asset pipeline.
