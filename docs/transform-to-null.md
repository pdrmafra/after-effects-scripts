# Transform to Null

Moves a layer's position, scale and rotation animation onto a new parent null. The layer itself goes back to neutral values, so you can add a second, independent layer of motion on top without touching the original animation.

![A layer's Position animation moves to a new parent null; the layer then gets its own motion on top](media/transform-to-null.gif)

## How to use

1. Save your project.
2. Select **exactly one** unlocked layer (footage, solid, precomp, shape or text).
3. Run **`Transform-to-Null.jsx`**.

A null named `CTRL_<layer name>` appears right above the layer and is selected. It now carries the animation; the layer is parented to it. One Cmd/Ctrl+Z undoes everything.

## What moves where

- **To the null:** Position (including separated dimensions), Scale, Z Rotation and, on 3D layers, Orientation and X/Y Rotation. Keyframe times, values, easing, motion-path handles, roving and labels are copied exactly and checked before the layer is changed.
- **Stays on the layer:** Anchor Point (and its animation) and Opacity. Position and Rotation become 0, Scale becomes 100.
- **The null** gets the layer's 2D/3D mode, timing, label color and former parent, with its anchor at zero. If the name already exists, a number is added.

This is a change of hierarchy, not a bake: masks, effects, shape-group transforms and time remapping are not moved.

## Not supported

- Cameras, lights, locked layers, Auto-Orient, collapsed precomps and continuously rasterized footage (native shape and text layers are fine).
- Layers with expressions anywhere, even disabled ones: moving a layer into a new hierarchy can change what an expression computes.

## Good to know

- Expressions on **other** layers that read this layer's transforms are not detected or rewritten, and inserting the null shifts layer indices that expressions may use.
- Effects whose look depends on the layer's own transform values, hierarchy or render order may change. Try effect-heavy layers on a copy first.
- If something fails midway, the script tries to restore the layer and removes only the null it created. If it says recovery is incomplete, press Undo right away.
