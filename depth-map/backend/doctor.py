"""Read-only environment check. Does not download, install or run models."""
import importlib.metadata
import json
import platform
from pathlib import Path


def main():
    backend = Path(__file__).resolve().parent
    report = {"python": platform.python_version(), "platform": platform.system(), "dependencies": {}, "models": {}}
    missing = []
    for name in ("numpy", "opencv-python", "torch", "torchvision", "timm", "einops", "easydict", "imageio", "imageio-ffmpeg", "matplotlib", "tqdm"):
        try:
            report["dependencies"][name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            missing.append(name)
    for repo, checkpoint in [("Depth-Anything-V2", "depth_anything_v2_vits.pth"), ("Video-Depth-Anything", "video_depth_anything_vits.pth")]:
        path = backend / "vendor" / repo
        report["models"][repo] = {"checkout": path.is_dir(), "small_checkpoint": (path / "checkpoints" / checkpoint).is_file()}
    if "torch" not in missing:
        import torch
        report["devices"] = {"mps": torch.backends.mps.is_available(), "cuda": torch.cuda.is_available(), "cpu": True}
    report["missing_dependencies"] = missing
    print(json.dumps(report, indent=2))
    return 1 if missing or any(not model["checkout"] or not model["small_checkpoint"] for model in report["models"].values()) else 0


if __name__ == "__main__":
    raise SystemExit(main())
