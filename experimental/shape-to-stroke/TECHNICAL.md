# Shape to Stroke — technical notes

Architecture, recognition rules, tolerances, fixtures and validation for the experimental Shape to Stroke tool. For everyday use, read the [user guide](README.md). See [CAPABILITIES.md](CAPABILITIES.md) for the applicability analysis, implemented families and limits.

## Architecture

```text
Selection → read-only snapshot → geometric recognizer → batch preflight
                                                        ↓
                           duplicate layers → centerline + stroke + Trim
                                                        ↓
                          verify writes → disable or delete originals
```

- `geometry.jsxinc`: pure ES3 functions, no AE access. Produces a two-point path, width, cap, direction and fit error.
- `circular.jsxinc`: pure ES3 ring/arc recognition with circle-center, radius, tangent, winding/topology and sampled-fit checks. Produces curved centerlines with explicit tangents; can reverse a contour without moving a closed ring's seam.
- `outlines.jsxinc`: pure ES3 paired-offset frame and angular connector recognizers. Normalizes proven straight handles/redundant vertices, checks simple topology/containment, matches corresponding segments, enforces uniform thickness and sizes polygon miters. Original arrays are never rewritten.
- `host.jsxinc`: reads AE structure/styles, rejects unsupported input, preserves group/layer transforms by duplicating the layer, edits only the duplicate's contents, verifies writes, then disables or explicitly deletes originals.
- `ui.jsxinc`: compact dialog with Original (Keep disabled / Delete), Animate Trim Paths, Create and Cancel. No report, Analyze button, duration field or success alert.
- `settings.jsxinc`: strict, versioned option record in AE's `app.settings`, section `PedroMafra.ShapeToStroke`, key `options_v1`. Successful Create saves both choices; Cancel and failed Create leave the previous record unchanged. Records saved by builds that still had Reverse keep their other two choices. No project content is stored. Missing/corrupt/unreadable preferences use safe defaults; a write failure does not fail the completed edit or add another dialog.
- `build.js`: creates the standalone `Shape-to-Stroke.jsx`; no runtime includes are needed for that built tool.
- `fixtures.jsxinc` / `Create-Test-Fixtures.jsx`: shared 106-case catalog and three synthetic demo comps (48 READY / 25 SKIP / 33 ICON layers forming 16 everyday icons), named with the collection version to distinguish older demos. The fixture launcher needs the adjacent includes; keep this folder together.
- `*.test.js`, `native-test.jsx`, `verify-renders.py`: geometry, mocked failure/recovery, preferences, dialog contract, fixture catalog, native integration and optional rendered-image QA.

## First supported cases

| Input | Output | Recognition |
| --- | --- | --- |
| Native rectangle, square corners | Open line + butt cap | Long axis; original visual length retained. |
| Native fully rounded rectangle | Open line + round cap | Center path is shortened by the width to account for both caps. |
| Closed four-vertex Bezier rectangle | Open line + butt cap | Straight edges, right angles, matching opposite edges. Rotated outlines supported. |
| Closed Bezier capsule | Open line + round cap | Two opposite equal straight sides, aligned ends, sampled curved-boundary fit, convexity and area checks. |
| Two concentric circular Bezier contours + one fill | Closed circular centerline + stroke | Distinct radii, same center, single traversal and actual hole under the fill rule. |
| Closed circular arc band with two straight radial ends | Open circular centerline + butt cap | Concentric boundaries, equal/opposite sweep, constant width and radial ends. |
| Circular arc band with semicircular ends | Open circular centerline + round cap | Matched concentric arc boundaries and half-width semicircular end caps, without overlap. |
| Two uniform polygon contours + one fill | Closed polygon + miter joins | Parallel corresponding sides, uniform perpendicular separation, simple nested contours and an actual hole. Convex and valid concave frames supported. |
| Two rounded line/circular-arc contours + one fill | Closed curved frame | Same offset checks, plus concentric corner arcs and tangent continuity. Rounded rectangles and capsule/racetrack frames supported. |
| Uniform angular ribbon with butt ends | Open polyline + miter joins | Two matched side chains, uniform width, perpendicular end caps and no crossings. L/V/Z/U/zigzag connectors supported. |

Rectangles/capsules must have a clear long axis (major/minor ratio at least 1.2). Default line direction is left-to-right, or top-to-bottom for vertical lines. A ring starts at the outer contour's first vertex and follows its winding. An arc follows the outer contour's direction. To draw the other way, switch on AE's **Reverse Path Direction** on the generated path; the dialog has no Reverse option.

Frames use the first nonredundant outer vertex and its winding. Angular connector direction follows the first accepted side-chain pairing. Polygon/connector inputs allow 3–64 closed-outline vertices. Safe normalization can remove redundant start vertices. Frames/connectors accept near-uniform thickness: the stroke width is the middle of the thinnest and thickest measurement (side ends, curved-corner radius differences and connector cap lengths), and the spread between them may be at most `max(0.005, min(2, width × 0.1))` local units. Each edge of the constant-width stroke therefore moves at most 0.5 local units from the original edge, or 2.5% of the width on thin artwork (about half a pixel at 100% scale; scaling the layer scales this on screen). The output still has one constant stroke width, so accepted near-uniform artwork is an approximation, not an exact silhouette or screen-pixel guarantee. `fitError` is the largest thickness residual (half the spread) or curved-fit error. Segment angular correspondence remains approximately 0.081 degrees; curved-center matching and cap perpendicularity retain `max(0.005, width × 0.0005)`. Dedicated bar/capsule/ring/arc fit limits are unchanged. Miter extension ratios above 50 are refused. Matched curved corners must join tangentially; arbitrary sharp line/curve joins are deferred. Round-ended circular arcs use 4–32 input vertices and reject touching/overlapping caps.

Circular inputs must be Bezier paths with 4–32 contour vertices, conventional circular cubic handles and segments spanning at most 90 degrees. Rings allow either opposite winding with Non-Zero fill or either winding with Even-Odd fill. Same-winding Non-Zero contours describe a filled disk and are rejected. A ring/frame path with AE's Reverse Path Direction switched on is refused, because it changes which area is filled; turn it off (switch the Fill Rule to Even-Odd if the hole disappears). Radius/handle checks use `max(0.002, radius × 0.0001)` local units, center matching uses `max(0.002, width × 0.0001)`, and sampled circular deviation must stay below `max(0.003, radius × 0.0005)`. Standard circular cubics are not mathematically exact circles; these are conservative fitted conversions, not pixel-identity guarantees.

Bezier capsule recognition is an approximation, not a universal centerline extractor. Every curved cubic is sampled at 32 subdivisions. Local-space boundary tolerance is `max(0.01, width × 0.001)`; values are local shape units, not guaranteed screen pixels. Very different scales/export topology may need a later adapter. A fit score is a geometric residual, not a probability or a guarantee of perfect rendering.

## Safety limits

- Enabled/unlocked 2D shape layers only, normal blending, one supported outline (or exactly two matching frame contours) and one solid fill. The leaf may be inside one nested group chain; multiple branches and other compound paths are deferred.
- Static shape contents/styles/group transforms. Layer transform keyframes can remain on the duplicate. Source-layer expressions, including disabled expressions, are rejected.
- No effects, masks, track mattes, enabled layer styles, gradients, existing strokes or shape operators. No unrelated elliptical rings, lettering, variable-width art, general Bezier ribbons, beveled/round polygon joins or intermediate corner radii on solid bars. Native frame operators must first be converted to Bezier paths; Merge Paths operators/multiple shape-group branches are not supported.
- Straight cubic handles are normalized only if collinear, ordered and contained within the chord. Bowed/overshooting/reversing handles are never flattened silently.
- Preflight is internal and read-only. Create makes replacements directly above originals, with unique names, and selects the replacements. Original geometry is never rewritten. **Keep disabled** is the first-run default; later runs restore the last successful selection, **including Delete**. Delete removes only the captured originals after every replacement has passed verification.
- Delete is rejected if an original parents another layer. Keep disabled preserves parenting links. Other external references to originals are not rewritten: use a project copy before choosing Delete.
- Timeline edits use one Undo group. Before deletion starts, caught failures attempt to remove this operation's copies and restore original visibility/selection. If deletion itself fails, replacements are retained to avoid destroying the only remaining version of a deleted source; use Undo immediately.
- Adding/removing layers changes indices. External index-based expressions or custom render-order dependencies are not rewritten or guaranteed.
- Animate Trim Paths is optional and off on first run, then follows your saved choice: LINEAR 0→100% over **12 comp frames** from current time, without a duration field or auto-easing. Keys must fit within the source layer and comp. When unchecked, Trim End stays at 100% with no keys.

## Expanded fixtures

READY contains native horizontal/vertical forms, rotated Bezier paths, nested mirrored/nonuniform transforms, thin bars, thick and short capsules, eight-vertex capsules, reversed winding and a changed first vertex.

It also contains compound rings (including even-odd fill, swapped winding/order, translated centers and thin strokes), quarter/half/three-quarter arc bands, oblique/reversed arcs and a nested mirrored arc. New cases cover square/rectangle/triangle/diamond/regular and irregular polygon frames, concave L/star frames, rounded/capsule frames, winding/order/handle variations, L/V/Z/U/zigzag connectors, rounded-ended arcs, acute triangles and 2-unit square frames. The former SKIP L-shaped outline is now supported as a uniform open connector.

SKIP contains solid triangle/star/square, trapezoid, intermediate corner radius, solid circle, ellipse, variable-width capsule, distorted curves, same-winding Non-Zero solid interiors, nonconcentric/elliptical/coincident ring contours, nonradial/variable-width arcs, changing-width/crossed/touching/outside-hole frames, distorted rounded frames, T junctions, arrowheads, skewed connector ends and overlapping rounded arc caps. These remain intentional rejection tests.

The ICONS comp shows 16 everyday icons built only from supported families: house, check mark, heartbeat, Wi-Fi, clock, battery, gauge, lightning, monoline M, arrow, speech bubble, plus, shield, smiley, menu and play. Multi-part icons are separate layers in one cell, as when an imported icon has been split into layers; every layer should convert. They are synthetic, not exporter samples.

## Manual test

1. Save a disposable project copy.
2. Run **File → Scripts → Run Script File → `Create-Test-Fixtures.jsx`**. It adds READY, SKIP and ICONS comps without editing existing comps or saving the project, then opens READY with its first layer selected. No extra success dialog is shown.
3. Select a READY layer and run **`Shape-to-Stroke.jsx`**. Choose **Keep disabled**, then Create. Check the restored choices each time; Delete is remembered too.
4. For a static A/B comparison, leave Animate Trim Paths off, then alternate source/replacement visibility. Compare endpoints, width, color, opacity and transforms at 100% Trim.
5. For motion, undo the operation, set comp time to zero, run again and enable Animate Trim Paths. Scrub the first 12 frames; then switch on Reverse Path Direction on the generated path and scrub again.
6. Test Delete on disposable demo layers, then Undo/Redo and verify original geometry, visibility and replacement count. Test each shape in the SKIP comp: Create should explain the rejection without making any copies.
7. Repeat on a copied real Figma/Illustrator import and record the path vertices/tangents or share a minimal non-client fixture. Synthetic tests do not prove exporter compatibility.
8. Choose different options, Create successfully, then rerun on another source: both choices should return. Change them and Cancel: reopening must still show the last successful choices. Also check after restarting the same AE version; preferences belong to that version/profile, not the project or Git checkout.

## Development and validation

Dated test results are kept in [Validation](../../docs/validation.md), not repeated here. Near-uniform frames/connectors use the edge-shift rule above (it replaced an earlier 5%-of-thickness allowance on 2026-10-09). The deformed Diamond measured in AE is accepted in Node with width 9.9915 and a 0.133-unit edge shift. The native/render evidence below predates both changes; visual comparison of near-uniform artwork is pending.

From this directory:

```sh
node build.js
node build.js --check
node --test *.test.js
```

Native tests must be run deliberately with permission in an open AE project. They create/remove their own temporary comps, restore the previous active comp, do not save the user's project, and write their own PNG/report outputs here. Native testing creates Undo history; it does not restore a previously saved/dirty project flag.

Verified 2026-10-09, before the thickness tolerance and the removal of Reverse: **129 native AE 26.5x89/macOS 27.0.1 scenarios**. The native test script has since been updated for the dialog without Reverse and for the Reverse Path Direction refusal; that updated native run is pending. Native cases include all 73 catalog shapes, demo construction, Keep disabled, mixed frame/connector/round-arc Delete, reverse curved handles, miter/cap settings, parenting-dependency rejection and real preference save/read in an isolated test namespace, which was cleaned/restored afterwards. The actual user options were not changed by the harness. Thirty-nine rendered full-reveal pairs had matching silhouette bounds; normalized alpha differences were below 0.6% of painted area (not pixel-identical). Thirty-five line/ring/arc/frame/connector draw-on samples were empty at 0% and had increasing coverage. Second-copy, miter-write/clamping and partial original-deletion failures were exercised with mocks, not injected native AE faults. Dialog controls/Create/Cancel/error behavior and restore on fresh sessions were exercised with UI mocks.

Optional QA after running `native-test.jsx`, with numpy/opencv available:

```sh
python verify-renders.py
```

Manual preference persistence across an AE restart, manual Undo/Redo, Windows, older AE, animated-parent cases and real exporter samples remain unverified. Root `npm run build`, `npm run check` and CI include this experimental build/suite; the standalone development commands above remain available.

## Next adapters

1. Real imported-shape fixtures: normalize redundant vertices/collinear handles without losing geometry; classify multi-group cases safely.
2. Broader curves: normalize unequal circular subdivisions and evaluate true general Bezier/elliptical offsets separately.
3. Beveled/rounded polygon joins, filleted/round-ended connectors and independent group branches, with dedicated topology adapters.
4. Assisted matte reveal: preserve variable-width original artwork and let the user supply a trajectory. Do not advertise automatic lettering/logo skeletonization.
5. Future idea: linearly tapered strokes using the stroke's Taper, starting with straight wedges. Not for near-uniform frames; first confirm how Taper behaves during a Trim Paths draw-on. See [CAPABILITIES.md](CAPABILITIES.md).
