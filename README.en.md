# Open Sea Skin · Lab (2.0.4)

**A living ocean skin** for DeepSeek Harness Desktop and Web: waves that follow your session load, a sky driven by real ephemeris data, a star field built from a real catalogue, and boats that are your running subagents.

![version](https://img.shields.io/badge/version-2.0.4-138b8b) ![license](https://img.shields.io/badge/license-MIT-138b8b) ![upstream](https://img.shields.io/badge/upstream-d--dev0101%2Fopen--sea--skin-6c7f8a)

---

## Project statement

This project is a **rebuilt fork (Lab branch)** of **[d-dev0101/open-sea-skin](https://github.com/d-dev0101/open-sea-skin)** (author **d-dev0101**, MIT licence) at version **1.2.7**. It is **not** an official upstream release and is not maintained by upstream.

It keeps upstream's rendering foundation (three.js WebGPU + TSL ocean, sky, clouds, glass approach) and rebuilds the wave driver, astronomical sky, star field, boat fleet and the whole settings panel on top of it, up to **2.0.4**. All current code, shaders, panel and tests are maintained here — please file issues against **this** repository, not upstream.

- Upstream: [d-dev0101/open-sea-skin](https://github.com/d-dev0101/open-sea-skin) · fork point `v1.2.7`
- Upstream licence: MIT, full text in [`LICENSE`](LICENSE); required third-party notices in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)
- Why the fork exists and how to fall back: [`docs/FORK.md`](docs/FORK.md)
- Current version: **2.0.4** (tag `v2.0.4`). 2.0.0 stays the frozen baseline and its tag still resolves to the source; the 2.0.0–2.0.3 releases are off the shelf, so only the newest installable package is published

---

## What is new compared with upstream 1.2.7

| # | Capability | What it actually does |
|---|---|---|
| 1 | **Load-driven waves** | Wave height follows current-session token throughput or the session's cumulative spend, with EMA smoothing and a trough floor; whitecaps and spray fade in with `dt·1.3` when the value overflows |
| 2 | **Real astronomical sky** | Local NOAA ephemeris recomputes solar altitude/azimuth every second; sunrise/sunset, moon phase and illumination, three twilight lines (Belt of Venus, Earth's shadow, dawn/dusk asymmetry). A single `skyLight` curve keeps the sky continuous all day |
| 3 | **Real star field** | 2,851 real stars (HYG subset with magnitude and B−V): size by magnitude, colour by temperature, four-point spikes on bright stars, 88 constellations over 150 polylines that breathe as a whole; the Milky Way visibility follows galactic-centre altitude; meteors advance every frame |
| 4 | **Boats tied to sessions** | One boat per **running subagent**, re-laid out immediately when you switch sessions; boat speed comes from the waves, not a stopwatch, and the exit side is frozen at the moment of departure |
| 5 | **Tunable performance and a real panel** | Quality tiers (high/balanced/power-saver) + frame caps (30/60/90/120) + quarter-resolution 9-tap bloom; eleven collapsible groups with search, one-line explanations per row, per-row persistence and baseline snapshots. Headless measurement: **126 ms → 70 ms** per frame |

Differences worth naming (same integrated-GPU machine):

- Stars: none upstream → 2,851 real stars, 88 constellations, 150 polylines here
- Panel: 4 groups upstream → **11 searchable groups** with saved baselines here
- Quality: fixed render ratio upstream → three quality tiers × four frame caps, plus adaptive scaling by real frame cost
- Glass: only the **two side rails**; the conversation column is never estimated, never painted over, and no dividers or dimming are drawn

> Per-feature detail and the 113 assertions live in [`README.zh.md`](README.zh.md) (Chinese).

---

## Install

Two ways to install: the **published package** (normal use) or a **local `link:`** (when you want to edit the renderer).

### Option 1: published package (recommended)

This repository is shaped for the DSH plugin market: `package.json` declares `dsh.bundle` (pointing at `cordis.patch.yml`), it is published to npm as `open-sea-skin-dsh`, a prebuilt tarball is attached to [Releases](https://github.com/BeckChiang/open-sea-skin/releases), and the repo carries the `dsh-plugin` topic.

```powershell
dsh plugin add open-sea-skin-dsh
```

Or install straight from GitHub (builds from this source tree):

```powershell
dsh plugin add github:BeckChiang/open-sea-skin
```

To skip the source build on your machine, use the prebuilt tarball from the Release (no `allowBuilds` approval needed):

```powershell
dsh plugin add https://github.com/BeckChiang/open-sea-skin/releases/download/v2.0.4/open-sea-skin-2.0.4.tgz
```

### Option 2: local link (for development)

1. Clone into the DSH plugin directory:

   ```powershell
   git clone https://github.com/BeckChiang/open-sea-skin.git "$env:USERPROFILE\DSH\plugins\open-sea-skin"
   ```

2. Add a `link:` dependency in the DSH profile (`%USERPROFILE%\.dsh\profiles\desktop\package.json`):

   ```json
   "open-sea-skin": "link:C:/Users/<you>/DSH/plugins/open-sea-skin"
   ```

3. Restart the desktop app (a change to the host half `plugin/index.js` requires a full restart; client-only changes only need F5).

**Verify**: the console should print

```text
[open-sea-skin] client lab-2.0.4
[open-sea-skin] ocean lab-2.0.4
```

---

## Settings panel

Open it from the round button in the top-right corner. The search box filters rows and auto-expands matching groups; every open starts fully collapsed.

| Group | Contents |
|---|---|
| Skin | master switch |
| Waves | driver (throughput / spend / manual), height, trough floor, turbulence, full-load height, smoothing, overflow gain |
| Sky | driver (real clock / manual), 24-hour slider and "now", latitude/longitude and geolocation, three time-zone modes, moon, sunrise/sunset and twilight readouts |
| Stars | dome distance and ratio, star size, brightness, temperature saturation and bias, magnitude cut-off and falloff, glow, background field, twinkle, Milky Way, three night modes, stars in daylight |
| Constellations | line brightness, width, ground fade height, twinkle strength/speed, spike threshold |
| Meteors | on/off, frequency, brightness |
| Clouds | coverage, drift speed, opacity |
| Boats | on/off, spread, tempo, size |
| Glass | master switch, opacity, radius, six shapes, per-rail strength, rail preview, performance mode |
| Advanced | quality tier, frame cap, live readout, bloom, save current settings as default, restore defaults |

### Quality tiers

| Tier | Pixel ratio | Target fps | Note |
|---|---|---|---|
| High | 1.5× | 90 | sharpness first, heavy on integrated GPUs, best on high-refresh panels |
| Balanced | 1.0× | 60 | middle ground |
| Power saver (default) | 0.85× | 30 | integrated-GPU friendly |

Picking a quality tier sets the cap to that tier suggestion (high 90 / balanced 60 / saver 30); you can still change the cap on its own afterwards, and a cap above your display rate just runs at the display rate. The render ratio additionally scales with measured frame cost. The **live readout** in the Advanced group shows the renderer's real state, not the requested one:

```text
running: tier power-saver · cap 30 fps · render scale 0.58× (screen 1.0×) · measured 30 fps
```

---

## Build and test

```powershell
node scripts/build-runtime.mjs     # shared/ + plugin/ → native-dist/
node tests/structure.test.mjs      # run files individually (node --test on the directory hits EPERM here)
```

Six `node:test` files, **113 assertions**: structure 62 / fleet 5 / stars 6 / sky 14 / solar 14 / sky-astro 12.

The star catalogue is a static derived file and never fetches at runtime: `node scripts/gen-stars-catalog.mjs` regenerates it from `d3-celestial`'s HYG, then rerun `build-runtime.mjs`.

---

## Known limitations

- **Static catalogue**: the 2,851 stars come from an HYG subset (via `d3-celestial`, CC BY-SA 4.0); updating means rerunning the generator.
- **The dome is a stereographic projection**: `θ' = 2·atan(tan(θ/2)/fold)`, designed to fit more sky into the same frame without distorting constellations — it is not a fisheye.
- **Headless browsers cannot judge the real look**: headless Edge has no WebGPU (falls back to software WebGL2), so frame timings are comparative only; the panel and glass need a real F5.
- **Nine shared stars** (Alpheratz, Elnath, Car/Pup/Vel, Ophiuchus/Serpens) appear in two constellations; it does not affect twinkling.

---

## Layout

```text
open-sea-skin-lab/
├── plugin/       # DSH plugin entry: index.js (asset server), client.js (panel + messaging)
├── shared/       # the logic that runs: ocean.js, sky.js, solar.js, stars-*.js
├── native-dist/  # build output (loaded by the iframe page)
├── scripts/      # build-runtime.mjs, gen-stars-catalog.mjs
├── tests/        # six node:test files
├── docs/         # FORK.md (fork decisions), CONTRACT.md (message contract)
└── README.md / README.zh.md / README.en.md / CHANGELOG.md
```

---

## Licence and credits

- This repository: **MIT** (`LICENSE`), `Copyright (c) 2026 Open Sea Skin contributors`.
- Upstream: **d-dev0101/open-sea-skin**, MIT, by **d-dev0101** — everything here started from it.
- Third party: three.js 0.178.0 (MIT), HYG catalogue via d3-celestial (CC BY-SA 4.0), Geist fonts (OFL). Per-item notices and local licence copies live in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and `native-dist/vendor/licenses/`.
