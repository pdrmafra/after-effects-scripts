# After Effects Scripts

Small tools from my motion-design workflow, shared freely. By [Pedro Mafra](https://pedromafra.com).

The current source collection includes **Shape to Stroke `0.0.5` (experimental)** alongside the first public beta tools. Save your project before running scripts. Tested scenarios and limitations are documented below; this is not a promise of compatibility with every AE version or project.

| Tool | What it does | Usage |
| --- | --- | --- |
| [Transform to Null](scripts/Transform-to-Null.jsx) | Moves one layer's transform animation onto a new parent null, leaving fresh controls on the original layer. | [Guide](docs/transform-to-null.md) |
| [Spacing Keyframes](scripts/Spacing-Keyframes.jsx) | Spaces chosen keys by an exact number of composition frames, with collision protection. | [Guide](docs/keyframes.md#spacing-keyframes) |
| [Stepped Keyframes](scripts/Stepped-Keyframes.jsx) | Samples the original animation between chosen keys, optionally using Hold interpolation. | [Guide](docs/keyframes.md#stepped-keyframes) |
| [Font Inspector](scripts/Font-Inspector.jsx) | Finds fonts and text occurrences in a comp and its nested comps. | [Guide](docs/font-inspector.md) |
| [Shape to Stroke (experimental)](experimental/shape-to-stroke/Shape-to-Stroke.jsx) | Recovers editable strokes from supported filled bars, frames, rings, arcs and angular connectors. | [Guide](experimental/shape-to-stroke/README.md) · [Supported families and limits](experimental/shape-to-stroke/CAPABILITIES.md) |
| [Depth Map](depth-map/) | Generates local 16-bit depth PNGs from stills or short comp sequences using Python models. | [Setup and limitations](depth-map/README.md) |

## Download and run

For the latest collection, use **Code → Download ZIP** on `main`. [Tagged releases](https://github.com/pdrmafra/after-effects-scripts/releases) are historical snapshots; the earlier `0.1.0-beta.1` ZIP does not include Shape to Stroke.

The four `.jsx` files in `scripts/` are standalone: choose **File → Scripts → Run Script File…** in After Effects. No Node, Python, Portal, plugin installer or companion include file is needed for these four scripts. They can also be run as file buttons in KBar; the scripts do not require KBar.

**Shape to Stroke** is also standalone: run `experimental/shape-to-stroke/Shape-to-Stroke.jsx` in the same way. Its synthetic fixture launcher needs the adjacent includes, but the actual converter does not. It remains experimental: real Figma/Illustrator export compatibility and manual Undo/Redo still need broader validation. The compact dialog remembers your last successful choices, including **Delete**; test with **Keep disabled** on a saved project copy first.

**Depth Map is different:** keep its `jsx/` and `backend/` folders together and complete the Python/model setup in its own README. The AE launcher currently supports macOS only. No models or Python environment are bundled.

## Safety and compatibility

- Verified native scenarios: After Effects **26.5x89 on macOS 27.0.1**. See [Validation](docs/validation.md) for exactly what was exercised. Windows and older AE versions have not been tested.
- Timeline changes use one Undo group. Validation happens before edits; caught failures attempt to restore captured data. If a recovery warning appears, use Undo immediately. Keep a saved backup.
- Timing tools refuse roving keys, temporal auto-Bezier/continuous keys and expressions on processed properties. This beta favors explicit failures over silently changing animation.
- Transform to Null rejects expressions anywhere on the source layer, Auto-Orient, cameras/lights and collapsed precomps. Expressions elsewhere that reference the source's local controls are not rewritten.
- Font reports may contain private text and names from your project. Review a report before sharing it.
- Depth Map runs inference locally; setup downloads external dependencies and weights. Generated files are not removed by AE Undo.

## Development

Edit `src/` for the four core tools, or the modules in `experimental/shape-to-stroke/` for that tool, then regenerate the standalone scripts:

```sh
npm run build
npm run check
```

Node 22 or newer is used for development/tests, not for running the five JSX tools. There are no npm dependencies. Root build/check commands include Shape to Stroke; **240 Node tests** cover the current collection. Native AE test scripts in `tools/` and `experimental/shape-to-stroke/` create disposable fixtures and must be run deliberately with permission. Depth tests and environment checks are documented separately.

## License and credits

My code is [MIT licensed](LICENSE) and provided without warranty. Depth Map's models and dependencies retain their own licenses; see [Third-party notices](depth-map/THIRD_PARTY.md). No font files, client projects, model weights or third-party source trees are included.

## Next

Shape to Stroke's next iteration needs real imported Figma/Illustrator shapes to validate the supported topology and conservative fitted conversions. It is not a general lettering/logo skeletonizer. New depth models will be evaluated separately rather than advertised as supported before testing.
