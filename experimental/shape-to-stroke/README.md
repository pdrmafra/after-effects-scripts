# Shape to Stroke — local prototype 0.0.1

Recover an editable centerline from a filled rectangle or uniform capsule. This is a local experiment, **not part of the published `0.1.0-beta.1` release**. Test on a saved project copy. Own code follows the collection's MIT license.

## Architecture

```text
Selection → read-only snapshot → geometric recognizer → batch preflight
                                                        ↓
                           duplicate layers → centerline + stroke + Trim
                                                        ↓
                          verify writes → optional hide originals
```

- `geometry.jsxinc`: pure ES3 functions, no AE access. Produces a two-point path, width, cap, direction and fit error.
- `host.jsxinc`: reads AE structure/styles, rejects unsupported input, preserves group/layer transforms by duplicating the layer, edits only the duplicate, verifies written values with AE precision tolerance, and attempts whole-batch cleanup on failure.
- `ui.jsxinc`: analysis report and explicit creation/visibility/animation options.
- `build.js`: creates the standalone `Shape-to-Stroke.jsx`; no runtime includes are needed for that built tool.
- `fixtures.jsxinc` / `Create-Test-Fixtures.jsx`: create a synthetic demo for manual testing. The fixture launcher needs the adjacent includes; keep this folder together.
- `geometry.test.js`, `host.test.js`, `native-test.jsx`, `verify-renders.py`: geometry, mocked failure/recovery, native integration and optional rendered-image QA.

## First supported cases

| Input | Output | Recognition |
| --- | --- | --- |
| Native rectangle, square corners | Open line + butt cap | Long axis; original visual length retained. |
| Native fully rounded rectangle | Open line + round cap | Center path is shortened by the width to account for both caps. |
| Closed four-vertex Bezier rectangle | Open line + butt cap | Straight edges, right angles, matching opposite edges. Rotated outlines supported. |
| Closed Bezier capsule | Open line + round cap | Two opposite equal straight sides, aligned ends, sampled curved-boundary fit, convexity and area checks. |

The shape must have a clear long axis (major/minor ratio at least 1.2). Default direction is left-to-right, or top-to-bottom for vertical lines; Reverse switches it.

Bezier capsule recognition is an approximation, not a universal centerline extractor. Every curved cubic is sampled at 32 subdivisions. Local-space boundary tolerance is `max(0.01, width × 0.001)`; values are local shape units, not guaranteed screen pixels. Very different scales/export topology may need a later adapter. A fit score is a geometric residual, not a probability or a guarantee of perfect rendering.

## Safety limits

- Enabled/unlocked 2D shape layers only, normal blending, one path and one solid fill. The leaf may be inside one nested group chain; multiple branches/paths are deferred.
- Static shape contents/styles/group transforms. Layer transform keyframes can remain on the duplicate. Source-layer expressions, including disabled expressions, are rejected.
- No effects, masks, track mattes, enabled layer styles, gradients, existing strokes or shape operators. No rings, compound paths, lettering, variable-width art, free curves or intermediate corner radii yet.
- A rectangle with collinear but nonzero Bezier handles is not currently recognized; do not flatten handles silently.
- Analyze is read-only. Create makes new layers directly above their originals, with unique names. Geometry on the original is never rewritten. Original visibility changes **only** when Hide originals is checked.
- If originals remain visible, they overlap the copies and obscure the reveal; toggle visibility manually to compare.
- Timeline edits use one Undo group. Caught failures attempt to remove only this operation's copies and restore source visibility. If recovery is incomplete, use Undo immediately.
- Adding any layer shifts other layer indices. External index-based expressions or custom render-order dependencies are not rewritten or guaranteed. Use a project copy.
- Draw-on is optional, LINEAR 0→100% from comp current time. Duration must fit within the source layer and comp. No auto-easing is applied.

## Manual test

1. Save a disposable project copy.
2. Run **File → Scripts → Run Script File → `Create-Test-Fixtures.jsx`**. It adds one new demo comp without editing existing comps or saving the project.
3. Select a layer named READY. Run **`Shape-to-Stroke.jsx`** and inspect Analyze.
4. For a static A/B comparison, leave both checkboxes off, create the copy, then toggle source/copy visibility. Compare endpoints, width, color, opacity and transforms at 100% Trim.
5. For motion, undo the copy, set the comp time to zero, run again, enable draw-on and Hide originals. Scrub the first 12 frames; test Reverse too.
6. Undo/Redo and verify source geometry and visibility. The SKIP fixture uses an unsupported intermediate corner radius: analysis should explain why; creating a mixed supported/unsupported selection must cancel before making any copies.
7. Repeat on a copied real Figma/Illustrator import and record the path vertices/tangents or share a minimal non-client fixture. Synthetic tests do not prove exporter compatibility.

## Development and validation

From this directory:

```sh
node build.js
node build.js --check
node --test geometry.test.js host.test.js
```

Native tests must be run deliberately with permission in an open AE project. They create/remove their own temporary comps, restore the previous active comp, do not save the user's project, and write their own PNG/report outputs here. Native testing creates Undo history; it does not restore a previously saved/dirty project flag.

Verified 2026-10-08: **36 Node tests; 10 native AE 26.5x89/macOS 27.0.1 scenarios**. Five rendered full-reveal pairs had matching silhouette bounds; normalized alpha differences were below 0.04% of painted area (not pixel-identical). Five draw-on samples were empty at 0% and had increasing coverage. Rollback on a second-copy write failure was exercised with mocks, not an injected native AE setter failure.

Optional QA after running `native-test.jsx`, with numpy/opencv available:

```sh
python verify-renders.py
```

Full end-user ScriptUI interaction, demo-launcher UI, manual Undo/Redo, Windows, older AE, animated-parent cases and real exporter samples remain unverified. The root collection build/tests are deliberately unchanged; run this prototype's suite separately.

## Next adapters

1. Real imported-shape fixtures: normalize redundant vertices/collinear handles without losing geometry; classify multi-group cases safely.
2. Rings/arcs: infer center paths only when thickness/topology is suitable.
3. Polylines/connectors: split at joins and preserve corner semantics.
4. Assisted matte reveal: preserve variable-width original artwork and let the user supply a trajectory. Do not advertise automatic lettering/logo skeletonization.
