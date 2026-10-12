# Depth Map — experimental

Local After Effects launcher plus Python backends for **16-bit grayscale PNG depth maps**. Stills use Depth Anything V2; sequences use Video Depth Anything. These are relative-depth outputs, not calibrated distances.

**macOS launcher, advanced setup.** This is not a one-click plugin. Small-model CPU inference and a small AE 26.5 export/import pipeline have been tested; see [Validation](../docs/validation.md). Long sequences, Windows, CUDA and higher-resolution performance are not covered by those tests. Generation runs in the background: After Effects stays usable, the panel shows progress, and Cancel stops it.

No Python environment, upstream source trees or model weights are distributed here. Inference stays local; setup requires internet downloads.

## Setup

1. Install **Python 3.12** if you do not have it: [python.org/downloads](https://www.python.org/downloads/) (macOS installer, any 3.12.x).
2. Double-click **`install.command`** in this folder. The first time, macOS may block it: right-click it, choose **Open**, then **Open** again.
3. Wait for **READY** in the Terminal window (the first run downloads about 1.3 GB). Running it again only checks what is already there.

It creates `backend/.venv`, downloads the pinned model code and the two Small checkpoints, verifies their checksums and runs the environment check. Nothing outside this folder is changed. Tested from an empty folder on macOS (Apple Silicon) with Homebrew Python 3.12.

### Manual setup

Use Python 3.12. Run from this `depth-map` directory:

```sh
python3.12 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt

mkdir -p backend/vendor
git clone https://github.com/DepthAnything/Depth-Anything-V2 backend/vendor/Depth-Anything-V2
git -C backend/vendor/Depth-Anything-V2 checkout a561b849ebae10a6f5ef49e26c83cbbcd36c71bf
git clone https://github.com/DepthAnything/Video-Depth-Anything backend/vendor/Video-Depth-Anything
git -C backend/vendor/Video-Depth-Anything checkout 4f5ae23172ba60fd7bc11ef671cca678842c7072

mkdir -p backend/vendor/Depth-Anything-V2/checkpoints backend/vendor/Video-Depth-Anything/checkpoints
curl --fail --location --output backend/vendor/Depth-Anything-V2/checkpoints/depth_anything_v2_vits.pth \
  https://huggingface.co/depth-anything/Depth-Anything-V2-Small/resolve/03876f8651c73a60fe4c2c48294e09fcb6838fcf/depth_anything_v2_vits.pth
curl --fail --location --output backend/vendor/Video-Depth-Anything/checkpoints/video_depth_anything_vits.pth \
  https://huggingface.co/depth-anything/Video-Depth-Anything-Small/resolve/256875362cff76724b920335dfb4b29dd611f66e/video_depth_anything_vits.pth
```

These commands are for a new installation. Do not clone over an existing checkout. Direct dependency versions are pinned from the tested macOS environment; this is not a complete transitive lockfile. Do not replace that environment by blindly installing both upstream requirements files over it.

Verify downloads against [CHECKSUMS.sha256](CHECKSUMS.sha256) before loading them:

```sh
shasum -a 256 -c CHECKSUMS.sha256
backend/.venv/bin/python backend/doctor.py
backend/.venv/bin/python -m unittest discover -s tests -v
```

The official Small-model cards report Apache-2.0 licenses. Other model sizes have different terms: consult [Third-party notices](THIRD_PARTY.md). Only the two Small checkpoints above were exercised. Use trusted checkpoints; `weights_only=True` reduces pickle exposure but is not a substitute for trusting the source.

## Run in After Effects

Keep the entire `depth-map` directory together. Use **File → Scripts → Run Script File… → `jsx/DepthMapStatic.jsx`**. Enable AE's **Allow Scripts to Write Files and Access Network** preference for local exports and Python orchestration; the launcher itself does not upload images or download models.

- Open a comp and press **Generate**. What it does depends on the selection:
  - **Still image layers selected:** one depth map per layer, placed right above it with the same timing and parented to it, so it sits exactly on the image and follows its position, scale, rotation and animation. The image layer's effects are not copied. The raw image file is processed, not the layer's effects/transforms. PNG, JPEG and TIFF are supported.
  - **Nothing selected, or a video/precomp layer:** the comp work area is rendered with its current effects/layers and turned into a depth sequence with Video Depth Anything, starting at the work-area start. Up to 300 frames.
- **Reuse:** each still's depth map is named from the image file (path, modification date, size), the quality and the model, so running Generate again on the same image reuses it instantly and the Project panel item is reused too. Editing the image or changing the quality makes a new one. Hold **Option** while clicking Generate to make a new one anyway; it replaces the old file only once the new one is complete. Sequences are always generated again.
- **Still quality:** Normal is the model's native size; High processes at about twice the size for finer detail (railings, hair, nets) and is still well under a second per image on an M4 Max. Sequences always use Normal: Video Depth Anything ran out of GPU memory above that size on Apple Silicon.
- Outputs go to a **Depth Maps** folder next to the saved project. For an unsaved project the panel asks once per session where to create that **Depth Maps** folder (pick your project folder), so files never land loose among your other files. Keep outputs with your project so imported footage stays online.
- **Effect** (optional), built from standard AE effects so it stays editable:
  - **Depth Reveal:** a Gradient Wipe driven by the depth makes the image appear near-first over 1 second, starting at the current time (stills) or at the work-area start (sequences, on an adjustment layer above everything). Tick the effect's Invert Gradient to make the background lead; move or retime its keys freely.
  - **Depth Sweep:** a white band of light travels through the scene from near to far over 1.5 seconds, then fades. It is a "Depth Sweep" solid in Add mode (above the image, parented to it; or above the whole comp for sequences). Change the solid's colour for a tinted scan, its "Sweep Width" slider for a wider band, and retime the "Sweep Front" keys.
  - **Parallax (stills only):** a Displacement Map driven by the depth moves near and far parts in opposite directions over 3 seconds, like a small camera orbit. Change Max Horizontal Displacement for a stronger move.
  - With an effect, the depth layer becomes a hidden control layer (eye off, not a guide layer).
- Imported files go into a **Depth Maps** folder in the Project panel (created once, then reused). Layers are guide layers unless you untick that option.
- When a run finishes, the window closes and a message says what was imported and how long it took. If it fails, a message shows why (the end of the model's log) and the window stays open; after a Cancel it stays open without a message.
- While it runs, **Generate** becomes **Cancel**. Cancel stops Python, imports nothing and deletes the files of that run (exported frames and partial depth). Closing the window or the project also cancels. The model works on blocks of about 32 frames, so sequence progress moves block by block.

The launcher requires the matching checkpoint for the chosen action: stills need the DAV2 checkpoint; sequences need the VDA checkpoint.

## Controls and limits

- The panel writes the full depth range with no adjustment. Shape it in AE, where it stays editable: Levels or Curves for contrast and midtones, Gaussian Blur to soften, Invert to swap near/far. The CLIs still accept `--clip-low`, `--clip-high`, `--gamma`, `--blur` and `--invert`.
- VDA uses one global normalization range across the clip, and this wrapper loads all RGB frames into RAM. Start with a short, low-resolution work area.
- RGB image inputs are used; transparency is not a depth mask. EXR input/color-management fidelity is not supported by this release.
- Generated PNGs and exported source frames stay on disk. AE Undo removes project edits, not filesystem output. Remove source exports manually only after verifying the result; keep imported depth files.
- Output sequences require an empty destination and a completion marker. Incomplete runs leave their partial output for diagnosis but are not imported by the panel.

## CLI and tests

```sh
backend/.venv/bin/python backend/generate_depth.py \
  --input /path/to/image.png --output /path/to/new_depth.png --encoder vits --device auto

backend/.venv/bin/python backend/generate_vda_sequence.py \
  --input-dir /path/to/png_frames --output-dir /path/to/empty_depth_folder \
  --fps 24 --encoder vits --device auto

backend/.venv/bin/python tests/smoke_inference.py --vendor backend/vendor --device cpu
```

All CLIs accept `--help`. Sequence filenames are naturally sorted; frame count must match the model result. Advanced users can explicitly increase `--max-frames`, accepting the memory/runtime cost. The smoke test uses tiny synthetic images and deletes its temporary files; it is a pipeline test, not a depth-quality benchmark.

## Future work

Newer models (Depth Anything 3, MoGe-2, Distill Any Depth) were compared on Apple Silicon in October 2026 with sample images and free photos (portrait hair, bare branches, bicycles, interiors). None beat the current Small model at **High** still quality, which kept the finest branches and bicycle spokes; MoGe-2 Large filled bicycle wheels and cut hair edges, Depth Anything 3 broke thin branches, Distill Any Depth matched the current model. The Small models stay.
