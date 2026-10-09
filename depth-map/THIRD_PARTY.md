# Third-party models and dependencies

Pedro's launcher/backends are covered by the repository MIT license. That license does **not** relicense external models, libraries, fonts or their outputs.

No third-party source trees or weights are included in this repository or release ZIP. Users install them separately from their publishers.

| External project | Pinned code revision | Upstream license information |
| --- | --- | --- |
| [Depth Anything V2](https://github.com/DepthAnything/Depth-Anything-V2) | `a561b849ebae10a6f5ef49e26c83cbbcd36c71bf` | [Source license](https://github.com/DepthAnything/Depth-Anything-V2/blob/a561b849ebae10a6f5ef49e26c83cbbcd36c71bf/LICENSE); [Small model card](https://huggingface.co/depth-anything/Depth-Anything-V2-Small) reports Apache-2.0. Upstream identifies Base/Large/Giant weights as CC-BY-NC-4.0. |
| [Video Depth Anything](https://github.com/DepthAnything/Video-Depth-Anything) | `4f5ae23172ba60fd7bc11ef671cca678842c7072` | [Source license](https://github.com/DepthAnything/Video-Depth-Anything/blob/4f5ae23172ba60fd7bc11ef671cca678842c7072/LICENSE); [Small model card](https://huggingface.co/depth-anything/Video-Depth-Anything-Small) reports Apache-2.0. Upstream identifies Base/Large weights as CC-BY-NC-4.0. |

The setup guide defaults to Small. Bigger models are not bundled, not tested here and not a blanket recommendation for commercial client work. Read the exact model license before using another checkpoint; free distribution of this tool does not remove external license conditions.

Python packages in `backend/requirements.txt` and their transitive dependencies retain their own licenses. Their installed distributions contain applicable notices. Preserve those notices if you later redistribute an environment or vendor their source; this release does neither.

Model-card revisions and SHA-256 hashes used for the tested Small downloads are recorded in the setup guide and checksum file. They were compared with publisher metadata on 2026-10-08.
