# Depth Map — experimental

Local After Effects launcher plus Python backends for **16-bit grayscale PNG depth maps**. Stills use Depth Anything V2; sequences can use frame-by-frame DAV2 or Video Depth Anything. These are relative-depth outputs, not calibrated distances.

**macOS launcher, advanced setup.** This is not a one-click plugin. Small-model CPU inference and a small AE 26.5 export/import pipeline have been tested; see [Validation](../docs/validation.md). Long sequences, Windows, CUDA and higher-resolution performance are not covered by those tests. The AE panel blocks while generating and has no reliable mid-inference cancel button.

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

- **Static:** select one image-footage layer or choose a PNG/JPEG/TIFF manually. The raw image source is processed, not the selected layer's effects/transforms. Video footage is not a static image input.
- **Sequence:** open a comp and set its work area. The comp is rendered with its current effects/layers. Choose Video Depth Anything or Frame batch. The panel limits work areas to 300 frames.
- Choose a **permanent output folder** when asked. Keep outputs with your project so imported footage stays online.
- Outputs can be imported as guide layers. Sequence imports use the composition frame rate and start at the work-area start.

The launcher requires the matching checkpoint for the chosen action: static generation does not require a VDA checkpoint; a VDA sequence does not require a DAV2 checkpoint.

## Controls and limits

- Clip low/high: percentile normalization. Gamma above 1 brightens midtones. Blur smooths gradients. Invert swaps near/far.
- Temporal smoothing applies only to frame-batch DAV2; it is a one-way exponential filter and can lag fast motion. Per-frame normalization can still flicker.
- VDA uses one global normalization range across the clip, and this wrapper loads all RGB frames into RAM. Start with a short, low-resolution work area.
- Input-size values are bounded to 64–4096. Larger sizes increase runtime/memory; they are not automatically better for every input.
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

Evaluate newer model adapters with real motion-design footage, quality/runtime comparisons and separate license checks. Add cancellation/progress in a non-blocking panel. Neither is claimed as supported in this beta.
