"""Optional native-render QA. Requires numpy/opencv; not an AE runtime dependency."""
from pathlib import Path
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent
NAMES = ["native-rectangle", "native-capsule", "bezier-rectangle", "bezier-capsule", "nested-scaled-capsule"]
NAMES += ["circular-ring", "even-odd-ring", "thin-ring", "quarter-arc", "three-quarter-arc", "oblique-arc", "nested-mirrored-arc"]


def read(name):
    value = cv2.imread(str(ROOT / name), cv2.IMREAD_UNCHANGED)
    if value is None or value.ndim != 3 or value.shape[2] != 4:
        raise ValueError(f"Missing RGBA native render: {name}")
    return value.astype(float) / np.iinfo(value.dtype).max


def bounds(alpha):
    ys, xs = np.where(alpha > 0.1)
    if not len(xs):
        return None
    return np.array([xs.min(), ys.min(), xs.max(), ys.max()])


def tile(image, label):
    result = np.zeros((210, 240, 3), dtype=np.uint8)
    rgb = image[:, :, :3] * image[:, :, 3:4]
    result[30:, :] = cv2.resize(np.clip(rgb * 255, 0, 255).astype(np.uint8), (240, 180))
    cv2.putText(result, label, (5, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (220, 220, 220), 1)
    return result


rows = []
for name in NAMES:
    before, after = read(name + "-before.png"), read(name + "-after.png")
    a, b = before[:, :, 3], after[:, :, 3]
    # Normalize by painted area, not the mostly empty canvas.
    error = float(np.abs(a - b).sum() / a.sum())
    delta = int(np.abs(bounds(a) - bounds(b)).max())
    print(f"{name}: alpha error / painted area={error:.6%}; silhouette bbox delta={delta}px")
    if error > 0.015 or delta > 1:
        raise AssertionError(f"Render mismatch: {name}")
    diff = np.zeros_like(before)
    diff[:, :, :3] = np.minimum(np.abs(a - b)[:, :, None] * 20, 1)
    diff[:, :, 3] = 1
    rows.append(np.concatenate([tile(before, name + " / fill"), tile(after, "recovered stroke"), tile(diff, "alpha diff x20")], axis=1))

for prefix in ["motion-", "motion-ring-", "motion-arc-"]:
    motion = [read(f"{prefix}{i}.png") for i in range(5)]
    coverage = [float(frame[:, :, 3].sum()) for frame in motion]
    print(prefix + " alpha coverage:", coverage)
    if coverage[0] > 0.001 or not all(a < b for a, b in zip(coverage, coverage[1:])):
        raise AssertionError("Draw-on is not empty at 0% / monotonic across sampled frames")
    strip = np.zeros((145, 720, 3), dtype=np.uint8)
    for i, frame in enumerate(motion):
        painted = frame[:, :, :3] * frame[:, :, 3:4]
        strip[35:, i * 144:(i + 1) * 144] = cv2.resize(np.clip(painted * 255, 0, 255).astype(np.uint8), (144, 110))
        cv2.putText(strip, f"{prefix}{i * 25}%", (i * 144 + 5, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (220, 220, 220), 1)
    rows.append(strip)
if not cv2.imwrite(str(ROOT / "comparison-sheet.png"), np.concatenate(rows, axis=0)):
    raise IOError("Cannot write QA sheet")
print("PASS: twelve rendered pairs and fifteen draw-on samples. Antialiasing is not pixel-identical.")
