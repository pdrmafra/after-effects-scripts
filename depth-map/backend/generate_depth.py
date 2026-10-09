#!/usr/bin/env python3
"""Generate a static depth map with Depth Anything V2.

This CLI is intentionally independent from After Effects so a future CEP panel
can call the same backend without changing the model pipeline.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from pipeline_utils import validate_processing


MODEL_CONFIGS = {
    "vits": {"encoder": "vits", "features": 64, "out_channels": [48, 96, 192, 384]},
    "vitb": {"encoder": "vitb", "features": 128, "out_channels": [96, 192, 384, 768]},
    "vitl": {"encoder": "vitl", "features": 256, "out_channels": [256, 512, 1024, 1024]},
    "vitg": {"encoder": "vitg", "features": 384, "out_channels": [1536, 1536, 1536, 1536]},
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a 16-bit grayscale depth map.")
    parser.add_argument("--input", required=True, help="Input image path.")
    parser.add_argument("--output", required=True, help="Output PNG path.")
    parser.add_argument(
        "--repo",
        default=os.environ.get("DEPTH_ANYTHING_V2_REPO", ""),
        help="Path to a local Depth-Anything-V2 checkout. Can also be set with DEPTH_ANYTHING_V2_REPO.",
    )
    parser.add_argument(
        "--checkpoint",
        default=os.environ.get("DEPTH_ANYTHING_V2_CHECKPOINT", ""),
        help="Path to depth_anything_v2_<encoder>.pth. Can also be set with DEPTH_ANYTHING_V2_CHECKPOINT.",
    )
    parser.add_argument("--encoder", choices=sorted(MODEL_CONFIGS), default="vits")
    parser.add_argument("--input-size", type=int, default=518)
    parser.add_argument("--device", choices=["auto", "mps", "cpu", "cuda"], default="auto")
    parser.add_argument("--invert", action="store_true", help="Invert output depth values.")
    parser.add_argument("--clip-low", type=float, default=0.0, help="Low percentile for contrast normalization.")
    parser.add_argument("--clip-high", type=float, default=100.0, help="High percentile for contrast normalization.")
    parser.add_argument("--gamma", type=float, default=1.0, help="Gamma adjustment after normalization. Values above 1 brighten midtones.")
    parser.add_argument("--blur", type=float, default=0.0, help="Gaussian blur radius in pixels after normalization.")
    return parser.parse_args()


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_dependencies(repo: Path):
    if not repo.exists():
        fail(f"Depth Anything V2 repo not found: {repo}")

    sys.path.insert(0, str(repo))

    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
        import torch  # type: ignore
        from depth_anything_v2.dpt import DepthAnythingV2  # type: ignore
    except ImportError as err:
        fail(
            "Missing Python dependency. Install backend/requirements.txt and the "
            f"Depth Anything V2 requirements first. Details: {err}"
        )

    return cv2, np, torch, DepthAnythingV2


def choose_device(torch, requested: str) -> str:
    if requested != "auto":
        if requested == "mps" and not torch.backends.mps.is_available():
            fail("MPS was requested but is not available in this Python/PyTorch environment.")
        if requested == "cuda" and not torch.cuda.is_available():
            fail("CUDA was requested but is not available in this Python/PyTorch environment.")
        return requested

    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def normalize_depth_float(np, cv2, depth, clip_low: float, clip_high: float, invert: bool, gamma: float, blur: float):
    try:
        validate_processing(clip_low, clip_high, gamma, blur)
    except ValueError as error:
        fail(str(error))
    depth = np.asarray(depth, dtype=np.float32)
    if depth.ndim != 2 or not depth.size or not np.isfinite(depth).all():
        fail("Depth output must be a non-empty finite 2D array.")

    lo = float(np.percentile(depth, clip_low))
    hi = float(np.percentile(depth, clip_high))

    if hi <= lo:
        fail("Depth output has no usable range.")

    normalized = (depth - lo) / (hi - lo)
    normalized = np.clip(normalized, 0.0, 1.0)

    if invert:
        normalized = 1.0 - normalized

    if gamma != 1.0:
        normalized = np.power(normalized, 1.0 / gamma)

    if blur > 0:
        radius = int(round(blur))
        kernel_size = max(3, radius * 2 + 1)
        if kernel_size % 2 == 0:
            kernel_size += 1
        normalized = cv2.GaussianBlur(normalized.astype(np.float32), (kernel_size, kernel_size), 0)
        normalized = np.clip(normalized, 0.0, 1.0)

    return normalized


def normalized_float_to_uint16(np, normalized):
    if not np.isfinite(normalized).all():
        fail("Normalized depth contains non-finite values.")
    return (np.clip(normalized, 0.0, 1.0) * 65535.0).round().astype(np.uint16)


def normalize_depth(np, cv2, depth, clip_low: float, clip_high: float, invert: bool, gamma: float, blur: float):
    normalized = normalize_depth_float(np, cv2, depth, clip_low, clip_high, invert, gamma, blur)
    return normalized_float_to_uint16(np, normalized)


def main() -> int:
    args = parse_args()
    try:
        validate_processing(args.clip_low, args.clip_high, args.gamma, args.blur, args.input_size)
    except ValueError as error:
        fail(str(error))
    input_path = Path(args.input).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    repo = Path(args.repo).expanduser().resolve() if args.repo else Path(__file__).parent / "vendor" / "Depth-Anything-V2"
    checkpoint = (
        Path(args.checkpoint).expanduser().resolve()
        if args.checkpoint
        else repo / "checkpoints" / f"depth_anything_v2_{args.encoder}.pth"
    )

    if output_path.suffix.lower() != ".png":
        fail("Output must be a .png file to preserve 16-bit depth.")
    if output_path.exists():
        fail("Output already exists; choose a new filename.")
    if not input_path.is_file():
        fail(f"Input image not found: {input_path}")
    if not checkpoint.exists():
        fail(f"Checkpoint not found: {checkpoint}")

    cv2, np, torch, DepthAnythingV2 = load_dependencies(repo)
    device = choose_device(torch, args.device)

    raw_img = cv2.imread(str(input_path), cv2.IMREAD_COLOR)
    if raw_img is None:
        fail(f"Could not read input image: {input_path}")

    model = DepthAnythingV2(**MODEL_CONFIGS[args.encoder])
    model.load_state_dict(torch.load(str(checkpoint), map_location="cpu", weights_only=True))
    model = model.to(device).eval()

    with torch.no_grad():
        depth = model.infer_image(raw_img, args.input_size)

    output = normalize_depth(np, cv2, depth, args.clip_low, args.clip_high, args.invert, args.gamma, args.blur)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not cv2.imwrite(str(output_path), output):
        fail(f"Could not write output image: {output_path}")

    print(str(output_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
