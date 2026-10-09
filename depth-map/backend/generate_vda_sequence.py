#!/usr/bin/env python3
"""Generate a temporally consistent depth PNG sequence with Video Depth Anything."""

from __future__ import annotations

import argparse
import sys
import math
from pathlib import Path

from generate_depth import choose_device, fail, normalized_float_to_uint16
from pipeline_utils import validate_processing, sequence_plan, complete_sequence


MODEL_CONFIGS = {
    "vits": {"encoder": "vits", "features": 64, "out_channels": [48, 96, 192, 384]},
    "vitb": {"encoder": "vitb", "features": 128, "out_channels": [96, 192, 384, 768]},
    "vitl": {"encoder": "vitl", "features": 256, "out_channels": [256, 512, 1024, 1024]},
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a VDA 16-bit grayscale depth PNG sequence.")
    parser.add_argument("--input-dir", required=True, help="Folder containing source frame PNGs.")
    parser.add_argument("--output-dir", required=True, help="Folder for generated depth PNGs.")
    parser.add_argument("--pattern", default="frame_*.png")
    parser.add_argument("--prefix", default="vda_depth_")
    parser.add_argument("--repo", default="", help="Path to a local Video-Depth-Anything checkout.")
    parser.add_argument("--checkpoint", default="", help="Path to video_depth_anything_<encoder>.pth.")
    parser.add_argument("--encoder", choices=sorted(MODEL_CONFIGS), default="vits")
    parser.add_argument("--input-size", type=int, default=518)
    parser.add_argument("--max-frames", type=int, default=300, help="Safety limit; this wrapper loads every RGB frame into RAM.")
    parser.add_argument("--fps", type=float, default=24.0)
    parser.add_argument("--device", choices=["auto", "mps", "cpu", "cuda"], default="auto")
    parser.add_argument("--invert", action="store_true")
    parser.add_argument("--clip-low", type=float, default=0.0)
    parser.add_argument("--clip-high", type=float, default=100.0)
    parser.add_argument("--gamma", type=float, default=1.0)
    parser.add_argument("--blur", type=float, default=0.0)
    parser.add_argument("--fp32", action="store_true", help="Force fp32 inference.")
    return parser.parse_args()


def load_vda_dependencies(repo: Path):
    if not repo.exists():
        fail(f"Video Depth Anything repo not found: {repo}")

    sys.path.insert(0, str(repo))

    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
        import torch  # type: ignore
        from video_depth_anything.video_depth import VideoDepthAnything  # type: ignore
    except ImportError as err:
        fail(f"Missing Video Depth Anything dependency. Details: {err}")

    return cv2, np, torch, VideoDepthAnything


def read_frames(cv2, np, frames):
    images = []
    expected_shape = None

    for frame_path in frames:
        image = cv2.imread(str(frame_path), cv2.IMREAD_COLOR)
        if image is None:
            fail(f"Could not read input frame: {frame_path}")
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        if expected_shape is None:
            expected_shape = image.shape
        elif image.shape != expected_shape:
            fail(f"Frame dimensions changed. Expected {expected_shape}, got {image.shape} for {frame_path}")

        images.append(image)

    return np.stack(images, axis=0)


def normalize_depths(np, cv2, depths, clip_low: float, clip_high: float, invert: bool, gamma: float, blur: float):
    try:
        validate_processing(clip_low, clip_high, gamma, blur)
    except ValueError as error:
        fail(str(error))
    depths = np.asarray(depths, dtype=np.float32)
    if depths.ndim != 3 or not depths.size or not np.isfinite(depths).all():
        fail("Depth sequence must be a non-empty finite 3D array.")

    lo = float(np.percentile(depths, clip_low))
    hi = float(np.percentile(depths, clip_high))
    if hi <= lo:
        fail("Depth output has no usable range.")

    normalized = np.clip((depths - lo) / (hi - lo), 0.0, 1.0)

    if invert:
        normalized = 1.0 - normalized
    if gamma != 1.0:
        normalized = np.power(normalized, 1.0 / gamma)
    if blur > 0:
        radius = int(round(blur))
        kernel_size = max(3, radius * 2 + 1)
        if kernel_size % 2 == 0:
            kernel_size += 1
        normalized = np.stack(
            [cv2.GaussianBlur(frame.astype(np.float32), (kernel_size, kernel_size), 0) for frame in normalized],
            axis=0,
        )
        normalized = np.clip(normalized, 0.0, 1.0)

    return normalized


def main() -> int:
    args = parse_args()
    input_dir = Path(args.input_dir).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    repo = Path(args.repo).expanduser().resolve() if args.repo else Path(__file__).parent / "vendor" / "Video-Depth-Anything"
    checkpoint = (
        Path(args.checkpoint).expanduser().resolve()
        if args.checkpoint
        else repo / "checkpoints" / f"video_depth_anything_{args.encoder}.pth"
    )

    try:
        validate_processing(args.clip_low, args.clip_high, args.gamma, args.blur, args.input_size)
        frames = sequence_plan(input_dir, output_dir, args.pattern, args.prefix, args.max_frames)
    except ValueError as error:
        fail(str(error))
    if not checkpoint.exists():
        fail(f"Checkpoint not found: {checkpoint}")
    if not math.isfinite(args.fps) or args.fps <= 0:
        fail("--fps must be greater than 0.")

    cv2, np, torch, VideoDepthAnything = load_vda_dependencies(repo)
    device = choose_device(torch, args.device)
    fp32 = args.fp32 or device != "cuda"

    source_frames = read_frames(cv2, np, frames)
    model = VideoDepthAnything(**MODEL_CONFIGS[args.encoder])
    model.load_state_dict(torch.load(str(checkpoint), map_location="cpu", weights_only=True), strict=True)
    model = model.to(device).eval()

    with torch.no_grad():
        depths, _ = model.infer_video_depth(source_frames, args.fps, input_size=args.input_size, device=device, fp32=fp32)

    if len(depths) != len(frames):
        fail(f"Model returned {len(depths)} depth frames for {len(frames)} inputs.")

    normalized = normalize_depths(np, cv2, depths, args.clip_low, args.clip_high, args.invert, args.gamma, args.blur)
    output_dir.mkdir(parents=True, exist_ok=True)

    for index, (frame_path, depth) in enumerate(zip(frames, normalized), start=1):
        output_path = output_dir / f"{args.prefix}{frame_path.name}"
        output = normalized_float_to_uint16(np, depth)

        if not cv2.imwrite(str(output_path), output):
            fail(f"Could not write output frame: {output_path}")

        print(f"{index}/{len(frames)} {output_path}", flush=True)

    complete_sequence(output_dir, len(frames), args.encoder, device)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
