# Validation

Executed on **2026-10-08**. These are bounded tests, not exhaustive production certification.

The core/depth evidence below refers to `0.1.0-beta.1`. The current `main` additionally includes the experimental Shape to Stroke build and validation described here.

## Shape to Stroke 0.0.5 — 2026-10-09

- **208 Node tests:** conservative geometric recognition, uniform polygon/rounded offsets, normalized handles/vertices, circle/arc fitting, winding/fill rules, bounds/topology, cyclic starts/reversal, compact dialog/preferences and mocked recovery/write-verification faults.
- **129 native scenarios:** AE 26.5x89 on macOS 27.0.1, all 73 synthetic catalog shapes, both original actions, mixed-batch Delete, reverse/animated Trim, corner/cap settings, parenting rejection and isolated preference save/read with cleanup. Temporary native fixtures were removed; user options and existing comps were not modified or saved. Separate approved READY/SKIP manual demo comps were left for testing.
- **39 full-reveal render pairs:** identical silhouette bounds; normalized alpha differences below 0.6% of painted area, not pixel identity. **35 draw-on samples** were empty at 0% and increased in coverage.
- Manual preference persistence across an AE restart, manual Undo/Redo, real Figma/Illustrator samples, Windows and older AE remain unverified. Synthetic fixtures are not exporter compatibility evidence.
- [Tool guide](../experimental/shape-to-stroke/README.md) and [applicability map](../experimental/shape-to-stroke/CAPABILITIES.md).

Root build/check and CI now include the experimental tool: **240 Node tests** in total. Native tests remain permissioned/manual; CI never launches After Effects or downloads model weights.

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
- Exact spatial-curve behavior between Stepped samples; zero-tangent insertion is an approximation.
- Newer depth-model adapters and real-footage quality comparisons.

CI runs the Node suite and lightweight Python tests without model downloads or After Effects. Re-run native fixtures deliberately after changes; they modify only their test assets but must not run without permission in a user's live session.
