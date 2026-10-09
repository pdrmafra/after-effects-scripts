# After Effects Scripts

Small tools from my motion-design workflow, shared freely. By [Pedro Mafra](https://pedromafra.com).

**First public beta: `0.1.0-beta.1`.** Save your project before running scripts. Tested scenarios and limitations are documented below; this is not a promise of compatibility with every AE version or project.

| Tool | What it does | Usage |
| --- | --- | --- |
| [Transform to Null](scripts/Transform-to-Null.jsx) | Moves one layer's transform animation onto a new parent null, leaving fresh controls on the original layer. | [Guide](docs/transform-to-null.md) |
| [Spacing Keyframes](scripts/Spacing-Keyframes.jsx) | Spaces chosen keys by an exact number of composition frames, with collision protection. | [Guide](docs/keyframes.md#spacing-keyframes) |
| [Stepped Keyframes](scripts/Stepped-Keyframes.jsx) | Samples the original animation between chosen keys, optionally using Hold interpolation. | [Guide](docs/keyframes.md#stepped-keyframes) |
| [Font Inspector](scripts/Font-Inspector.jsx) | Finds fonts and text occurrences in a comp and its nested comps. | [Guide](docs/font-inspector.md) |
| [Depth Map](depth-map/) | Generates local 16-bit depth PNGs from stills or short comp sequences using Python models. | [Setup and limitations](depth-map/README.md) |

## Download and run

Download the ZIP from [Releases](https://github.com/pdrmafra/after-effects-scripts/releases), or use **Code → Download ZIP**.

The four `.jsx` files in `scripts/` are standalone: choose **File → Scripts → Run Script File…** in After Effects. No Node, Python, Portal, plugin installer or companion include file is needed for these four scripts. They can also be run as file buttons in KBar; the scripts do not require KBar.

**Depth Map is different:** keep its `jsx/` and `backend/` folders together and complete the Python/model setup in its own README. The AE launcher currently supports macOS only. No models or Python environment are bundled.

## Safety and compatibility

- Verified native scenarios: After Effects **26.5x89 on macOS 27.0.1**. See [Validation](docs/validation.md) for exactly what was exercised. Windows and older AE versions have not been tested.
- Timeline changes use one Undo group. Validation happens before edits; caught failures attempt to restore captured data. If a recovery warning appears, use Undo immediately. Keep a saved backup.
- Timing tools refuse roving keys, temporal auto-Bezier/continuous keys and expressions on processed properties. This beta favors explicit failures over silently changing animation.
- Transform to Null rejects expressions anywhere on the source layer, Auto-Orient, cameras/lights and collapsed precomps. Expressions elsewhere that reference the source's local controls are not rewritten.
- Font reports may contain private text and names from your project. Review a report before sharing it.
- Depth Map runs inference locally; setup downloads external dependencies and weights. Generated files are not removed by AE Undo.

## Development

Edit `src/`, then regenerate the standalone scripts:

```sh
npm run build
npm run check
```

Node 22 or newer is used for development/tests, not for running the four JSX tools. There are no npm dependencies. Native AE test scripts in `tools/` create disposable fixtures and must be run deliberately with permission. Depth tests and environment checks are documented separately.

## License and credits

My code is [MIT licensed](LICENSE) and provided without warranty. Depth Map's models and dependencies retain their own licenses; see [Third-party notices](depth-map/THIRD_PARTY.md). No font files, client projects, model weights or third-party source trees are included.

## Next

Shape to Stroke is intentionally not part of this release. Its next iteration needs real imported Figma/Illustrator shapes to validate centerline reconstruction. New depth models will be evaluated separately rather than advertised as supported before testing.
