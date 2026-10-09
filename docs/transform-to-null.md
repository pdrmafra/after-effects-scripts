# Transform to Null

Select **exactly one unlocked visual layer** in the active comp, then run `Transform-to-Null.jsx`.

The script creates `CTRL_<layer name>` immediately above the source and selects only the controller. The controller inherits the source's 2D/3D mode, timing, label color and former parent. Name collisions receive a numeric suffix.

Transferred controls: Position (including separated dimensions), Scale, Z Rotation, and 3D Orientation/X/Y Rotation when present. Key times, values, interpolation, temporal ease, spatial tangents, continuity, auto-Bezier, roving and labels are copied. Every transferred channel is verified before the source is reparented/reset.

The controller's Anchor Point is zero. The source retains its own Anchor Point animation and Opacity; its Position/Rotation become zero and Scale becomes 100. This allows a second layer of local adjustments without moving the existing animation into expressions.

## Limits

- No cameras, lights, locked layers, Auto-Orient or collapsed precomps/continuously rasterized footage. Native shape and text layers are allowed.
- Expressions anywhere on the source layer are rejected, including disabled expressions. Moving a layer into a new hierarchy can change expression context.
- Expressions on other layers that reference the source's local transforms are not detected or rewritten. Layer-index expressions elsewhere can also be affected by inserting a null.
- The script does not preserve the visual result of effects that depend on local transform values, hierarchy or render order. Test effect-heavy layers on a project copy.
- This is a hierarchy transfer, not an animation bake. It does not transfer Opacity, masks, shape-group transforms, effects or time remapping.

Use Undo to remove the controller and restore the source. In a caught failure, the script attempts its own rollback and removes only newly created unused null footage; an incomplete recovery explicitly asks you to Undo.
