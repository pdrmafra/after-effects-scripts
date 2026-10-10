# Changelog

## 0.3.0-beta.1 — 2026-10-10

- Spacing Keyframes and Stepped Keyframes are now part of Keyframe Tools; the separate scripts and their guide were removed.
- Add Keyframe Tools: a compact dockable ScriptUI panel with icon buttons for Space, Step, Keep every Nth key, keys to layer in/out and trim layers to their keys (in, out or both), plus KBar arguments for each action. Its tiles rearrange into a column, a 3 × 3 square or a single row to fit the panel, never leaving one tile alone. It replaces Pedro's separate Key To In/Out and Trim scripts with safer versions: preflight, collision checks, one Undo group and rollback.
- Trimming ignores layer markers and keeps the last key's frame inside the layer; keys to layer out lands on the layer's last visible frame.

## 0.2.0-beta.1 — 2026-10-09

- Add Shape to Stroke as an explicitly experimental standalone tool, with one canonical build and no version-suffixed copies.
- Recover supported bars/capsules, circular rings/arcs, polygon/rounded frames and angular connectors; retain conservative width/topology checks and full-batch preflight.
- Compact dialog with Keep disabled/Delete, animated Trim Paths, Create and Cancel; remember successful choices. The Reverse option was removed: use AE's Reverse Path Direction on the generated path.
- Frames and angular connectors accept near-uniform thickness: the stroke uses the middle width and each edge may move at most 0.5 local units (2.5% of the width on thin artwork).
- Refuse ring/frame paths with Reverse Path Direction switched on; explain unsupported single-path shapes with one clear message.
- Add applicability map, 106 synthetic fixtures (including an ICONS demo comp with 16 everyday icons), tool-specific Node tests and documented native/render validation.
- Include the experimental build and tests in root `npm run build`, `npm run check` and GitHub CI.
- Font Inspector: the report-save error message now breaks lines correctly.
- Stepped Keyframes: Position samples split the original motion path, so hand-pulled handles no longer loop around the new keys.
- Font Inspector: reused precomps are read once per scan; much faster on heavily nested projects, same report.
- Depth Map: the window warns that After Effects stops responding while generating.
- Shape to Stroke: the replacement keeps the original layer comment and appends its note.
- Illustrative GIFs for Shape to Stroke and Transform to Null, regenerated with `npm run media`.
- Shorter, task-first guides for every tool; technical detail moved to separate pages (Shape to Stroke `TECHNICAL.md`, `docs/development.md`).
- One version for the whole collection; `npm run check` verifies generated headers and test-comp names.
- `npm run package` builds a release ZIP with only the scripts users need, a plain-text read-me, license and changelog.
- Publish the latest source on `main`; keep historical commits/tags for recovery rather than maintaining separate old builds.

## 0.1.0-beta.1 — 2026-10-08

First curated public collection, derived from Pedro's personal scripts. Originals remain unchanged.

- Transform to Null: zero controller pivot, explicit class handling, verified channel copy, unique names, guarded hierarchy transfer and rollback.
- Spacing: explicit selected/all-key scope, composition-frame timing, collision preflight and key-data preservation.
- Stepped: stable original intervals, pre-sampled values, retained existing keys, optional Hold mode and insertion limit.
- Keyframe serialization: property-value-type spatial detection and safe handling of Hold-only Source Text.
- Font Inspector: portable text report/save UI, canonical font names, safer reveal references, scope warnings and timestamp carry fix.
- Depth Map: source-only distribution, environment check, tested dependency pins, safer checkpoint loading, durable output folder selection, finite-value validation, natural sequence order, overwrite protection and complete-sequence markers.
- English usage guides, explicit beta limitations, automated tests and native AE integration fixtures.
