# Depth Map — experimental

Local After Effects launcher plus Python backends for **16-bit grayscale PNG depth maps**. Stills use Depth Anything V2; sequences use Video Depth Anything. These are relative-depth outputs, not calibrated distances.

**macOS launcher, advanced setup.** This is not a one-click plugin. Small-model CPU inference and a small AE 26.5 export/import pipeline have been tested; see [Validation](../docs/validation.md). Long sequences, Windows, CUDA and higher-resolution performance are not covered by those tests. Generation runs in the background: After Effects stays usable, the panel shows progress, and Cancel stops it.

No Python environment, upstream source trees or model weights are distributed here. Inference stays local; setup requires internet downloads.

## Setup

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
- **Still quality:** Normal is the model's native size; High processes at about twice the size for finer detail (railings, hair, nets) and is still well under a second per image on an M4 Max. Sequences always use Normal: Video Depth Anything ran out of GPU memory above that size on Apple Silicon.
- Outputs go to a **Depth Maps** folder next to the saved project. For an unsaved project the panel asks for a permanent folder once per session. Keep outputs with your project so imported footage stays online.
- **Effect** (optional), built from standard AE effects so it stays editable:
  - **Depth Reveal:** a Gradient Wipe driven by the depth makes the image appear near-first over 1 second, starting at the current time (stills) or at the work-area start (sequences, on an adjustment layer above everything). Tick the effect's Invert Gradient to make the background lead; move or retime its keys freely.
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

A first comparison of newer models (Depth Anything 3, MoGe-2, Distill Any Depth) on sample images found no clear replacement for the current Small models; MoGe-2 Large is the candidate for cleaner edges on stills, pending tests on real motion-design footage.
