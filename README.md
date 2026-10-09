# After Effects Scripts

Free tools from my motion-design workflow. By [Pedro Mafra](https://pedromafra.com).

| Tool | What it does | Guide |
| --- | --- | --- |
| **Transform to Null** | Moves a layer's position, scale and rotation animation onto a new parent null, so you can add a second layer of motion on top. | [Guide](docs/transform-to-null.md) |
| **Spacing Keyframes** | Spaces the selected keyframes an exact number of frames apart. | [Guide](docs/keyframes.md#spacing-keyframes) |
| **Stepped Keyframes** | Adds keys every few frames between the selected ones, optionally with Hold for a stepped, stop-motion feel. | [Guide](docs/keyframes.md#stepped-keyframes) |
| **Font Inspector** | Lists every font used in a comp and its precomps, and jumps to each layer that uses it. | [Guide](docs/font-inspector.md) |
| **Shape to Stroke** *(experimental)* | Turns filled outline shapes into editable strokes you can animate with Trim Paths. | [Guide](experimental/shape-to-stroke/README.md) |
| **Depth Map** *(advanced, macOS)* | Generates depth-map images from stills or short comp sequences with local AI models. Needs a Python setup. | [Setup](depth-map/README.md) |

## See them in action

**[Shape to Stroke](experimental/shape-to-stroke/README.md)** finds the path running through the middle of a filled shape and gives it a stroke that fills it.

[![Shape to Stroke: the outline of a filled shape, the path the script finds through its middle, and the stroke that fills it](docs/media/shape-to-stroke.gif)](experimental/shape-to-stroke/README.md)

**[Transform to Null](docs/transform-to-null.md)** moves a layer's animation to a new parent null, so the layer can get its own motion on top.

[![Transform to Null: a layer's Position animation moves to a new parent null; the layer then gets its own motion on top](docs/media/transform-to-null.gif)](docs/transform-to-null.md)

## Install

1. Open **[Releases](https://github.com/pdrmafra/after-effects-scripts/releases)**, download the ZIP from the newest release at the top and unzip it.
2. In After Effects choose **File → Scripts → Run Script File…** and pick a script from the `Scripts` folder.

Each file in `Scripts` works on its own; there is nothing else to install. To keep them in the **File → Scripts** menu, copy them into After Effects' Scripts folder and restart AE:

- macOS: `/Applications/Adobe After Effects <version>/Scripts`
- Windows: `C:\Program Files\Adobe\Adobe After Effects <version>\Support Files\Scripts`

They also work as KBar buttons. Font Inspector's **Save Report** and Depth Map need **Allow Scripts to Write Files and Access Network** (Settings or Preferences → Scripting & Expressions).

Depth Map is different: keep its whole `depth-map` folder and follow its [setup guide](depth-map/README.md) first.

## Before you use them

- **Save your project first.** Each script's changes undo with a single Cmd/Ctrl+Z.
- The scripts check everything before changing your comp. When something is not supported they stop and explain why instead of guessing.
- Tested on After Effects 26.5 on macOS. Windows and older versions have not been tested yet.
- The keyframe tools refuse roving keys, auto-Bezier/continuous keys and properties with expressions rather than change them silently.
- Font Inspector reports can contain your project's text and layer names. Check a report before sharing it.
- Depth Map runs entirely on your computer. After Effects stays busy while it generates, with no cancel button, and its image files are not removed by Undo.

Found a problem or have an idea? [Open an issue](https://github.com/pdrmafra/after-effects-scripts/issues).

## License

My code is [MIT licensed](LICENSE) and provided without warranty. Depth Map's models and dependencies keep their own licenses; see [Third-party notices](depth-map/THIRD_PARTY.md). No font files, client projects or model weights are included.

## For developers

Building, tests and release packaging: [Development](docs/development.md). What was tested, and how: [Validation](docs/validation.md). Changes: [Changelog](CHANGELOG.md).
