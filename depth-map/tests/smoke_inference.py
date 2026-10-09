"""Optional real-model smoke test on synthetic images, never client footage.

Usage: python smoke_inference.py --vendor /path/to/existing/vendor --device cpu
Writes only inside its own TemporaryDirectory and cleans up afterward.
"""
import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path
import cv2
import numpy as np


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--vendor", required=True, type=Path)
    parser.add_argument("--device", choices=["cpu", "mps", "cuda"], default="cpu")
    args = parser.parse_args()
    backend = Path(__file__).resolve().parents[1] / "backend"
    with tempfile.TemporaryDirectory(prefix="pedro-depth-smoke-") as folder:
        root = Path(folder); source = root / "source"; source.mkdir()
        for index in range(2):
            image = np.zeros((96, 128, 3), np.uint8)
            image[:] = [40, 70, 100]
            cv2.rectangle(image, (20+index*2, 20), (90+index*2, 75), (220, 180, 80), -1)
            cv2.circle(image, (55, 45), 12, (255, 255, 255), -1)
            assert cv2.imwrite(str(source / f"frame_{index+1:06}.png"), image)
        jobs = [("generate_depth.py", "Depth-Anything-V2", root / "static.png"),
                ("generate_depth_sequence.py", "Depth-Anything-V2", root / "batch"),
                ("generate_vda_sequence.py", "Video-Depth-Anything", root / "vda")]
        for script, repo, output in jobs:
            command = [sys.executable, str(backend / script), "--repo", str(args.vendor / repo), "--input-size", "112", "--device", args.device]
            if script == "generate_depth.py":
                command += ["--input", str(source / "frame_000001.png"), "--output", str(output)]
            else:
                command += ["--input-dir", str(source), "--output-dir", str(output)]
            subprocess.run(command, check=True)
            paths = [output] if output.suffix == ".png" else sorted(output.glob("*.png"))
            assert len(paths) == (1 if output.suffix == ".png" else 2)
            for path in paths:
                image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
                assert image.dtype == np.uint16 and image.shape == (96, 128), (path, image.dtype, image.shape)
            if output.is_dir():
                assert json.loads((output / "depth_complete.json").read_text())["frames"] == 2
            print(f"PASS {script}: {len(paths)} 16-bit PNG(s), 128x96", flush=True)


if __name__ == "__main__":
    main()
