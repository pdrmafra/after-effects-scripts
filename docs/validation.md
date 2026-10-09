# Validation

Executed on **2026-10-08**. These are bounded tests, not exhaustive production certification.

The core/depth evidence below was recorded for `0.1.0-beta.1`; those tools' behavior is unchanged in `0.2.0-beta.1` apart from one Font Inspector message fix. Shape to Stroke, new in `0.2.0-beta.1`, has its own section.

## Shape to Stroke — 2026-10-09

- **263 Node tests (after the edge-shift rule, removing Reverse and adding icons):** geometric recognition, polygon/rounded offsets, normalized handles/vertices, circle/arc fitting, winding/fill rules, bounds/topology, cyclic starts/reversal, compact dialog/preferences and mocked recovery/write-verification faults. Thickness tests cover the edge-shift rule on 10-, 4- and 100-unit frames (accepted just inside, rejected just outside), the middle width on the deformed Diamond and connector caps, and unchanged angular/concentric checks. All 73 original catalog shapes keep their READY/SKIP classification; 33 new icon layers (16 icons) are all accepted, and a browser preview of their recovered strokes matched the fills. Later tests cover the dialog without Reverse, reading older saved options, the clear unsupported-shape message and refusing ring paths whose Reverse Path Direction is on (value 3; 1 and 2 accepted).
- **Read-only native check of the earlier 5% rule:** the manually deformed Diamond in the open AE project was accepted with width 10.12445, residual 0.26584 and tolerance 0.50622 local units. Its coordinates now give width 9.9915 and a 0.133-unit edge shift in Node; not yet rechecked in AE. No layers, preferences, selection or project files were changed. Visual comparison of this approximate conversion is still pending.
- **129 earlier native scenarios (before the 5% adjustment):** AE 26.5x89 on macOS 27.0.1, all 73 synthetic catalog shapes, both original actions, mixed-batch Delete, reverse/animated Trim, corner/cap settings, parenting rejection and isolated preference save/read with cleanup. Temporary native fixtures were removed; user options and existing comps were not modified or saved. Separate approved READY/SKIP manual demo comps were left for testing.
- **39 earlier full-reveal render pairs (before the 5% adjustment):** identical silhouette bounds; normalized alpha differences below 0.6% of painted area, not pixel identity. **35 draw-on samples** were empty at 0% and increased in coverage. These render results do not establish the visual error of newly accepted near-uniform artwork.
- **Manual AE check by the author (2026-10-09, after the edge-shift rule, Reverse removal and ICONS demo):** reported as all correct. The automated native script was not run for these changes (no results file).
- Manual preference persistence across an AE restart, manual Undo/Redo, real Figma/Illustrator samples, Windows and older AE remain unverified. Synthetic fixtures are not exporter compatibility evidence.
- [Tool guide](../experimental/shape-to-stroke/README.md) and [applicability map](../experimental/shape-to-stroke/CAPABILITIES.md).

Root build/check and CI include the experimental tool: **295 Node tests** in total, passed locally after these changes. The updated native script, including a real Reverse Path Direction check, has not been run yet. Native tests remain permissioned/manual; CI never launches After Effects or downloads model weights.

## Fixes after the Shape to Stroke update — 2026-10-09

- **Stepped Keyframes:** spatial samples now split the original Bezier motion path (de Casteljau) instead of keeping full-length handles on the bounding keys, which could loop around close samples. Four Node tests. Manual AE check by the author: a hand-curved two-key Position path stepped every 4 frames kept its arc with no loops. The automated native check was added but not run.
- **Font Inspector:** each text layer is read once per scan; reused precomps reuse the result under each instance path. One Node test confirms 3 instances, 2 character reads and 3 reported paths.
- **Depth Map:** the window states that After Effects stops responding during generation, with no cancel. Syntax checked only.
- **Shape to Stroke:** the replacement keeps the original layer comment and appends its note. One Node test.
- `npm run check`: **302 Node tests** passed locally.

## Automated checks

- **32 Node tests:** timing math, selected/all-key scope, collision preflight, 29.97 fps, invalid intervals, unsupported flags/expressions, stable multi-interval sampling, retained intermediate keys, Hold scope, key metadata, injected write-failure rollback, Hold-only TextDocument behavior, spatial value-type detection, mixed fonts, fallback/error warnings, precomp cycle protection, timestamp carry, launcher syntax and shell quoting.
- **8 Python tests:** uint16 endpoints, normalization, inversion/gamma, clipping, blur, invalid/non-finite controls and maps, global sequence normalization, natural ordering, overwrite/limit/prefix safeguards and completion metadata.
- **3 real-model CPU smoke paths:** static DAV2, two-frame DAV2 batch and two-frame VDA. Each produced the expected number of `128×96` uint16 PNGs. Python **3.12.14**; direct dependency versions are in `depth-map/backend/requirements.txt`. Official Small-checkpoint hashes matched the installed files.

## Native After Effects

AE **26.5x89**, macOS **27.0.1**. Fixtures created temporary comps and cleaned their own comps, imported footage and null-solid sources. Existing user comps were not edited or saved.

**12 script integration scenarios passed:**

- Spacing selected keys, retained unselected keys and labels.
- Collision cancellation without mutation.
- Stepped processing with three selected keys and retained intermediate keys.
- Hold mode boundaries.
- Transform transfer in 2D, 3D, separated 3D Position and roving Position.
- For every transform case, three world-space points were compared before/after at five times, with a transformed parent and animated source anchor. 3D cases included orientation.
- Transform expression rejection.
- Mask-path and Source Text key values after spacing.
- Mixed-character fonts and read-only inspection.

**4 Depth Map integration scenarios passed:** synthetic work-area PNG export, static generation/import, DAV2 sequence generation/import and VDA sequence generation/import. Imported sequences had the expected 24 fps. These tests invoked the actual launcher helpers with a configured existing environment.

## Still unverified

- Windows, older AE versions, GPU/HD production performance and long video clips.
- Full fresh-environment installation: model tests used the existing Python environment, with installed versions recorded rather than reinstalling it.
- End-user interaction with every ScriptUI button, report-save flow, KBar launch and manual Undo/Redo in a representative project.
- Every effect/render-order interaction and external expression dependency after hierarchy transfer.
- Stepped motion-path subdivision beyond the author's manual check: eased timing, intermediate keys and 3D Position were covered by Node tests only; the native check `step keeps a hand-curved Position path` in `tools/native-test.jsx` has not been run yet.
- Newer depth-model adapters and real-footage quality comparisons.

CI runs the Node suite and lightweight Python tests without model downloads or After Effects. Re-run native fixtures deliberately after changes; they modify only their test assets but must not run without permission in a user's live session.
