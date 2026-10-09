# Shape to Stroke — local prototype 0.0.3

Recover an editable centerline from a filled rectangle or uniform capsule. This is a local experiment, **not part of the published `0.1.0-beta.1` release**. Test on a saved project copy. Own code follows the collection's MIT license.

## Architecture

```text
Selection → read-only snapshot → geometric recognizer → batch preflight
                                                        ↓
                           duplicate layers → centerline + stroke + Trim
                                                        ↓
                          verify writes → disable or delete originals
```

- `geometry.jsxinc`: pure ES3 functions, no AE access. Produces a two-point path, width, cap, direction and fit error.
- `host.jsxinc`: reads AE structure/styles, rejects unsupported input, preserves group/layer transforms by duplicating the layer, edits only the duplicate's contents, verifies writes, then disables or explicitly deletes originals.
- `ui.jsxinc`: compact dialog with Original (Keep disabled / Delete), Animate Trim Paths, Reverse, Create and Cancel. No report, Analyze button, duration field or success alert.
- `settings.jsxinc`: strict, versioned option record in AE's `app.settings`, section `PedroMafra.ShapeToStroke`, key `options_v1`. Successful Create saves all three choices; Cancel and failed Create leave the previous record unchanged. No project content is stored. Missing/corrupt/unreadable preferences use safe defaults; a write failure does not fail the completed edit or add another dialog.
- `build.js`: creates the standalone `Shape-to-Stroke.jsx`; no runtime includes are needed for that built tool.
- `fixtures.jsxinc` / `Create-Test-Fixtures.jsx`: shared 23-case catalog and two synthetic demo comps (12 READY / 11 SKIP). The fixture launcher needs the adjacent includes; keep this folder together.
- `*.test.js`, `native-test.jsx`, `verify-renders.py`: geometry, mocked failure/recovery, preferences, dialog contract, fixture catalog, native integration and optional rendered-image QA.

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
- Preflight is internal and read-only. Create makes replacements directly above originals, with unique names, and selects the replacements. Original geometry is never rewritten. **Keep disabled** is the first-run default; later runs restore the last successful selection, **including Delete**. Delete removes only the captured originals after every replacement has passed verification.
- Delete is rejected if an original parents another layer. Keep disabled preserves parenting links. Other external references to originals are not rewritten: use a project copy before choosing Delete.
- Timeline edits use one Undo group. Before deletion starts, caught failures attempt to remove this operation's copies and restore original visibility/selection. If deletion itself fails, replacements are retained to avoid destroying the only remaining version of a deleted source; use Undo immediately.
- Adding/removing layers changes indices. External index-based expressions or custom render-order dependencies are not rewritten or guaranteed.
- Animate Trim Paths is optional and off on first run, then follows your saved choice: LINEAR 0→100% over **12 comp frames** from current time, without a duration field or auto-easing. Keys must fit within the source layer and comp. When unchecked, Trim End stays at 100% with no keys.

## Expanded fixtures

READY contains native horizontal/vertical forms, rotated Bezier paths, nested mirrored/nonuniform transforms, thin bars, thick and short capsules, eight-vertex capsules, reversed winding and a changed first vertex.

SKIP contains triangle, star, L-shaped outline, trapezoid, intermediate corner radius, circle, ellipse, compound ring, quarter-arc band, variable-width capsule and distorted curves. These are **intentional rejection tests**, not newly supported shapes. No converter geometry rules were expanded in this update.

## Manual test

1. Save a disposable project copy.
2. Run **File → Scripts → Run Script File → `Create-Test-Fixtures.jsx`**. It adds READY and SKIP comps without editing existing comps or saving the project, then opens READY with its first layer selected. No extra success dialog is shown.
3. Select a READY layer and run **`Shape-to-Stroke.jsx`**. Choose **Keep disabled**, then Create. Check the restored choices each time; Delete is remembered too.
4. For a static A/B comparison, leave Animate Trim Paths off, then alternate source/replacement visibility. Compare endpoints, width, color, opacity and transforms at 100% Trim.
5. For motion, undo the operation, set comp time to zero, run again and enable Animate Trim Paths. Scrub the first 12 frames; test Reverse too.
6. Test Delete on disposable demo layers, then Undo/Redo and verify original geometry, visibility and replacement count. Test each shape in the SKIP comp: Create should explain the rejection without making any copies.
7. Repeat on a copied real Figma/Illustrator import and record the path vertices/tangents or share a minimal non-client fixture. Synthetic tests do not prove exporter compatibility.
8. Choose different options, Create successfully, then rerun on another source: all three choices should return. Change them and Cancel: reopening must still show the last successful choices. Also check after restarting the same AE version; preferences belong to that version/profile, not the project or Git checkout.

## Development and validation

From this directory:

```sh
node build.js
node build.js --check
node --test *.test.js
```

Native tests must be run deliberately with permission in an open AE project. They create/remove their own temporary comps, restore the previous active comp, do not save the user's project, and write their own PNG/report outputs here. Native testing creates Undo history; it does not restore a previously saved/dirty project flag.

Verified 2026-10-09: **88 Node tests; 37 native AE 26.5x89/macOS 27.0.1 scenarios**. Native cases include all 23 catalog shapes, demo construction, Keep disabled, explicit Delete, parenting-dependency rejection and real preference save/read in an isolated test namespace, which was cleaned/restored afterwards. The actual user options were not changed by the harness. Five rendered full-reveal pairs had matching silhouette bounds; normalized alpha differences were below 0.04% of painted area (not pixel-identical). Five draw-on samples were empty at 0% and had increasing coverage. Second-copy write failure and partial original-deletion failure were exercised with mocks, not injected native AE faults. Dialog controls/Create/Cancel/error behavior and restore on fresh sessions were exercised with UI mocks.

Optional QA after running `native-test.jsx`, with numpy/opencv available:

```sh
python verify-renders.py
```

Pedro reported the prototype and compact revision worked. Manual preference persistence across an AE restart, manual Undo/Redo, Windows, older AE, animated-parent cases and real exporter samples remain unverified. The root collection build/tests are deliberately unchanged; run this prototype's suite separately.

## Next adapters

1. Real imported-shape fixtures: normalize redundant vertices/collinear handles without losing geometry; classify multi-group cases safely.
2. Rings/arcs: infer center paths only when thickness/topology is suitable.
3. Polylines/connectors: split at joins and preserve corner semantics.
4. Assisted matte reveal: preserve variable-width original artwork and let the user supply a trajectory. Do not advertise automatic lettering/logo skeletonization.
