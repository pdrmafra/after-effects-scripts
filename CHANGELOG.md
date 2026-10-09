# Changelog

## Current main — 2026-10-09

- Add Shape to Stroke `0.0.5` as an explicitly experimental standalone tool, with one canonical build and no version-suffixed copies.
- Recover supported bars/capsules, circular rings/arcs, polygon/rounded frames and angular connectors; retain conservative width/topology checks and full-batch preflight.
- Compact dialog with Keep disabled/Delete, animated Trim Paths, Create and Cancel; remember successful choices. The Reverse option was removed: use AE's Reverse Path Direction on the generated path.
- Frames and angular connectors accept near-uniform thickness: the stroke uses the middle width and each edge may move at most 0.5 local units (2.5% of the width on thin artwork).
- Refuse ring/frame paths with Reverse Path Direction switched on; explain unsupported single-path shapes with one clear message.
- Add applicability map, 106 synthetic fixtures (including an ICONS demo comp with 16 everyday icons), tool-specific Node tests and documented native/render validation.
- Include the experimental build and tests in root `npm run build`, `npm run check` and GitHub CI.
- Font Inspector: the report-save error message now breaks lines correctly.
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
