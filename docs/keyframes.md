# Keyframe tools

Both tools work on keyframes you select in the active comp. Intervals are whole **comp frames**, using the comp's real frame duration (fractional frame rates such as 29.97 included).

## Spacing Keyframes

Spaces keyframes an exact number of frames apart.

1. Select the keyframes to move.
2. Run **`Spacing-Keyframes.jsx`** and enter the spacing in frames.
3. Optionally tick **Start at current time** (otherwise spacing starts at the first selected key).
4. Leave **Move ALL keys** unticked to move only the selected keys; tick it to move every key in the selected properties.
5. Click **Apply**.

Each property is spaced on its own. Unselected keys keep their time and value. If a moved key would land on an unselected key, the whole operation is cancelled, including the other properties. A single key can be moved to the current time. Keys are not clipped to the layer's in/out points; After Effects allows keys outside them.

## Stepped Keyframes

Adds keys every few frames between selected keys, for a stepped or stop-motion feel.

1. Select **two or more** keys on each property.
2. Run **`Stepped-Keyframes.jsx`** and enter the interval in frames.
3. Optionally tick **Hold between samples** for hard steps.
4. Click **Apply**.

New keys are placed between each pair of consecutive selected keys, with values taken from the original animation before anything changes. Existing keys are kept and never overwritten.

- **Without Hold:** new keys are linear in time. On Position, the motion path is split at the new keys so it keeps the original curve, including handles you pulled by hand; the speed between samples is close to, not identical to, the original.
- **With Hold:** every key inside the selected range becomes Hold, including unselected keys there. The last selected key and keys outside the range keep their interpolation.

## Supported properties

Numbers, colors, 2D/3D Position, mask and shape paths and Source Text. Not supported: custom-value properties and markers.

## Refused before any change

- Roving keys, temporal auto-Bezier or continuous keys: switch them off first.
- Locked layers and properties with expressions.

Easing, interpolation, selection and keyframe labels of existing keys are kept (unless Hold mode changes the interpolation). Motion-path handles are kept too, except that Stepped shortens the handles next to new samples so the path keeps its shape. One Cmd/Ctrl+Z undoes everything.

## Good to know

- Keys with auto-Bezier motion paths let After Effects recalculate their handles around the new keys, so the path may shift slightly near them. If a sample does not lie on the original curve (unexpected), that stretch keeps straight handles as in earlier versions.
- One run adds at most 10,000 keys; use a larger interval for long ranges.
