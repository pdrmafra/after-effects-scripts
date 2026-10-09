# Keyframe tools

Select properties and keys in the active composition. Intervals are positive whole numbers of **composition frames**, using the actual frame duration (including fractional frame rates).

Numeric, color, 2D/3D Position, path and Source Text properties are accepted. Custom-value properties and markers are not. Roving keys, temporal auto-Bezier/continuous keys, locked layers and expressions on processed properties are rejected before edits. Manual temporal ease, spatial tangents, interpolation, selection and labels are retained for existing keys unless Hold mode explicitly changes interpolation.

## Spacing Keyframes

1. Select the keys to move.
2. Enter spacing in frames.
3. Choose whether to start at the first chosen key or the current-time indicator.
4. Leave **Move ALL keys** unchecked for selected keys only. Check it to match the older script's behavior of moving every key in the selected properties.

Spacing is calculated independently for each property. Unselected keys keep their times and values. If a moved key would land on an unselected key, the entire operation is cancelled, including other selected properties.

A single key can be moved with **Start at current time**. There is no automatic clipping to layer bounds: AE permits animation keys outside a layer's visible interval.

## Stepped Keyframes

Select two or more keys per property. Samples are inserted at the chosen interval between consecutive selected keys. With three selected keys, both intervals are processed using the original times, without index drift.

All values are sampled from the original pre-expression curve **before any property is changed**. Existing keys at sample times are not overwritten. Existing unselected keys inside the intervals remain.

- Default: add linear samples. This approximates the original curve at sample times; it does not guarantee identical interpolation between samples. Hold-only properties such as Source Text remain Hold-only.
- **Hold between samples:** changes interpolation for keys inside the selected intervals to Hold, including existing unselected keys there. The final selected endpoint and keys outside the intervals retain their interpolation.

Spatial samples use zero tangents. This is not an exact spatial-curve subdivision algorithm; use a project copy and check the motion. A single operation is limited to 10,000 new keys.
