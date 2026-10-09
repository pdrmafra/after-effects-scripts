# Changelog

## Current main — 2026-10-09

- Add Shape to Stroke `0.0.5` as an explicitly experimental standalone tool, with one canonical build and no version-suffixed copies.
- Recover supported bars/capsules, circular rings/arcs, polygon/rounded frames and angular connectors; retain conservative width/topology checks and full-batch preflight.
- Compact dialog with Keep disabled/Delete, animated Trim Paths, Reverse, Create and Cancel; remember successful choices.
- Add applicability map, 73 synthetic fixtures, 208 tool-specific Node tests and documented native/render validation.
- Include the experimental build and tests in root `npm run build`, `npm run check` and GitHub CI. The current Node suite totals 240 tests.
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
