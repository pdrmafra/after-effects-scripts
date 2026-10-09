"""Lightweight validation and file planning; no model downloads or inference."""
from __future__ import annotations

import json
import math
import re
from pathlib import Path


def validate_processing(clip_low, clip_high, gamma, blur, input_size=None):
    if not all(math.isfinite(v) for v in (clip_low, clip_high, gamma, blur)):
        raise ValueError("Processing controls must be finite numbers.")
    if not 0 <= clip_low < clip_high <= 100:
        raise ValueError("Clip percentiles must satisfy 0 <= low < high <= 100.")
    if gamma <= 0 or not 0 <= blur <= 100:
        raise ValueError("Gamma must be positive; blur must be between 0 and 100 px.")
    if input_size is not None and not 64 <= input_size <= 4096:
        raise ValueError("Input size must be between 64 and 4096.")


def natural_key(path):
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", path.name)]


def sequence_plan(input_dir: Path, output_dir: Path, pattern: str, prefix: str, max_frames: int):
    if not input_dir.is_dir():
        raise ValueError(f"Input folder not found: {input_dir}")
    if input_dir == output_dir:
        raise ValueError("Input and output folders must be different.")
    if not re.fullmatch(r"[A-Za-z0-9_-]+", prefix):
        raise ValueError("Prefix must contain only letters, numbers, underscores and hyphens.")
    frames = sorted((p for p in input_dir.glob(pattern) if p.is_file()), key=natural_key)
    if not frames:
        raise ValueError(f"No frames matched {pattern} in {input_dir}")
    if max_frames < 1 or len(frames) > max_frames:
        raise ValueError(f"Sequence contains {len(frames)} frames; limit is {max_frames}. Use a shorter sequence or --max-frames explicitly.")
    if any(p.suffix.lower() != ".png" for p in frames):
        raise ValueError("Sequences must contain PNG frames.")
    if output_dir.exists() and any(output_dir.iterdir()):
        raise ValueError("Output folder must be empty; previous output will not be overwritten.")
    return frames


def complete_sequence(output_dir: Path, frame_count: int, encoder: str, device: str):
    # Created ONLY after every PNG succeeds. The AE UI refuses partial sequences.
    manifest = {"complete": True, "frames": frame_count, "encoder": encoder, "device": device, "bit_depth": 16}
    (output_dir / "depth_complete.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
