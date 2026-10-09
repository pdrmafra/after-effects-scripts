# Development

The scripts are ExtendScript (ES3) files run by After Effects. Node 22 or newer is used only to build and test them; there are no npm dependencies.

## Layout

| Path | Contents |
| --- | --- |
| `src/` | Sources of the four core tools; `core.jsxinc` is shared by the timing tools and Transform to Null. |
| `scripts/` | Generated standalone builds of the core tools. Do not edit by hand. |
| `experimental/shape-to-stroke/` | Shape to Stroke modules, generated `Shape-to-Stroke.jsx`, test comps, tests and [technical notes](../experimental/shape-to-stroke/TECHNICAL.md). |
| `depth-map/` | Depth Map launcher, Python backends and tests. See its [README](../depth-map/README.md). |
| `tests/`, `tools/` | Node tests and mocks for the core tools; build/package scripts and native AE test scripts. |

## Build and check

```sh
npm run build
npm run check
```

`build` regenerates every standalone script, stamping the version from `package.json`. `check` verifies the builds are current and runs every Node test; CI runs the same command plus the lightweight Depth Map Python tests.

## Release package

```sh
npm run package
```

Builds `dist/after-effects-scripts-v<version>.zip` with only what users need: the five standalone scripts, the Shape to Stroke test-comp launcher with its companion files, the Depth Map folder (without environments or weights), a plain-text read-me, the license and the changelog. Attach that ZIP to the GitHub release; the release tag should match the version in `package.json`.

## Native After Effects tests

`tools/native-test.jsx`, `tools/native-depth-test.jsx` and `experimental/shape-to-stroke/native-test.jsx` run inside an open AE project. They create and remove their own temporary comps, do not save the project, and write results next to themselves. Run them deliberately, on a disposable project, never in someone's live session. Optional render QA for Shape to Stroke: `python verify-renders.py` in its folder (numpy/opencv).

## Shape to Stroke preview image

```sh
node experimental/shape-to-stroke/preview.js
```

Regenerates `images/icons-before-after.svg` from the ICONS test shapes using the tool's own geometry code. Rerun it after changing those shapes or the recognizers.

## Guide animations

```sh
npm run media
```

Regenerates the illustrative GIFs in `docs/media/` from the scenes in `tools/media/` (the Shape to Stroke scene uses the tool's own geometry and ICONS test shapes). Needs ffmpeg and Chrome, Chromium or Edge (set `BROWSER` to its executable if it is not found). Pass a scene name, such as `npm run media -- transform-to-null`, to rebuild only one. These are illustrations of each tool's effect, not screen recordings.

## Version

One version for the whole collection, in `package.json`. Generated script headers and the Shape to Stroke test-comp names use it; `npm run check` fails if they disagree.
