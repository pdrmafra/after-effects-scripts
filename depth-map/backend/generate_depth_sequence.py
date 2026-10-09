#!/usr/bin/env python3
"""Generate a depth PNG sequence from an input image sequence."""

from __future__ import annotations

import argparse
import sys
import math
from pathlib import Path

from generate_depth import MODEL_CONFIGS, choose_device, fail, load_dependencies, normalize_depth_float, normalized_float_to_uint16
from pipeline_utils import validate_processing, sequence_plan, complete_sequence


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a 16-bit grayscale depth PNG sequence.")
    parser.add_argument("--input-dir", required=True, help="Folder containing source frame PNGs.")
    parser.add_argument("--output-dir", required=True, help="Folder for generated depth PNGs.")
    parser.add_argument("--pattern", default="*.png", help="Input glob pattern. Default: *.png")
    parser.add_argument("--prefix", default="depth_", help="Output filename prefix.")
    parser.add_argument("--repo", default="", help="Path to a local Depth-Anything-V2 checkout.")
    parser.add_argument("--checkpoint", default="", help="Path to depth_anything_v2_<encoder>.pth.")
    parser.add_argument("--encoder", choices=sorted(MODEL_CONFIGS), default="vits")
    parser.add_argument("--input-size", type=int, default=518)
    parser.add_argument("--max-frames", type=int, default=300, help="Safety limit; explicitly increase for longer sequences.")
    parser.add_argument("--device", choices=["auto", "mps", "cpu", "cuda"], default="auto")
    parser.add_argument("--invert", action="store_true")
    parser.add_argument("--clip-low", type=float, default=0.0)
    parser.add_argument("--clip-high", type=float, default=100.0)
    parser.add_argument("--gamma", type=float, default=1.0)
    parser.add_argument("--blur", type=float, default=0.0)
    parser.add_argument(
        "--temporal-smoothing",
        type=float,
        default=0.0,
        help="Exponential smoothing strength from 0 to 1. 0 disables smoothing; 0.85 is strong.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_dir = Path(args.input_dir).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    repo = Path(args.repo).expanduser().resolve() if args.repo else Path(__file__).parent / "vendor" / "Depth-Anything-V2"
    checkpoint = (
        Path(args.checkpoint).expanduser().resolve()
        if args.checkpoint
        else repo / "checkpoints" / f"depth_anything_v2_{args.encoder}.pth"
    )

    try:
        validate_processing(args.clip_low, args.clip_high, args.gamma, args.blur, args.input_size)
        frames = sequence_plan(input_dir, output_dir, args.pattern, args.prefix, args.max_frames)
    except ValueError as error:
        fail(str(error))
    if not checkpoint.exists():
        fail(f"Checkpoint not found: {checkpoint}")

    if not math.isfinite(args.temporal_smoothing) or args.temporal_smoothing < 0 or args.temporal_smoothing >= 1:
        fail("--temporal-smoothing must be >= 0 and < 1.")

    cv2, np, torch, DepthAnythingV2 = load_dependencies(repo)
    device = choose_device(torch, args.device)

    model = DepthAnythingV2(**MODEL_CONFIGS[args.encoder])
    model.load_state_dict(torch.load(str(checkpoint), map_location="cpu", weights_only=True))
    model = model.to(device).eval()
    output_dir.mkdir(parents=True, exist_ok=True)
    previous_depth = None

    with torch.no_grad():
        for index, frame_path in enumerate(frames, start=1):
            raw_img = cv2.imread(str(frame_path), cv2.IMREAD_COLOR)
            if raw_img is None:
                fail(f"Could not read input frame: {frame_path}")

            depth = model.infer_image(raw_img, args.input_size)

            normalized = normalize_depth_float(
                np,
                cv2,
                depth,
                args.clip_low,
                args.clip_high,
                args.invert,
                args.gamma,
                args.blur,
            )
            if previous_depth is not None and previous_depth.shape == normalized.shape and args.temporal_smoothing > 0:
                normalized = (args.temporal_smoothing * previous_depth) + ((1.0 - args.temporal_smoothing) * normalized)
                normalized = np.clip(normalized, 0.0, 1.0)

            previous_depth = normalized.copy()
            output = normalized_float_to_uint16(np, normalized)
            output_path = output_dir / f"{args.prefix}{frame_path.name}"

            if not cv2.imwrite(str(output_path), output):
                fail(f"Could not write output frame: {output_path}")

            print(f"{index}/{len(frames)} {output_path}", flush=True)

    complete_sequence(output_dir, len(frames), args.encoder, device)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
