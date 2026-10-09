import json
import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
import numpy as np
import cv2
from generate_depth import normalize_depth_float, normalized_float_to_uint16
from generate_vda_sequence import normalize_depths
from pipeline_utils import validate_processing, sequence_plan, complete_sequence


class PipelineTests(unittest.TestCase):
    def test_uint16_endpoints(self):
        value = normalized_float_to_uint16(np, np.array([0.0, 0.5, 1.0]))
        self.assertEqual(value.dtype, np.uint16)
        self.assertEqual(value.tolist(), [0, 32768, 65535])

    def test_normalization_inversion_gamma(self):
        depth = np.array([[0, 1, 2]], dtype=np.float32)
        normal = normalize_depth_float(np, cv2, depth, 0, 100, False, 1, 0)
        inverse = normalize_depth_float(np, cv2, depth, 0, 100, True, 1, 0)
        gamma = normalize_depth_float(np, cv2, depth, 0, 100, False, 2, 0)
        np.testing.assert_allclose(normal, [[0, 0.5, 1]])
        np.testing.assert_allclose(normal + inverse, 1)
        self.assertGreater(gamma[0, 1], normal[0, 1])

    def test_percentile_clipping(self):
        result = normalize_depth_float(np, cv2, np.arange(100).reshape(10, 10), 10, 90, False, 1, 0)
        self.assertEqual(result.min(), 0)
        self.assertEqual(result.max(), 1)

    def test_blur_is_bounded(self):
        depth = np.zeros((8, 8)); depth[4, 4] = 1
        result = normalize_depth_float(np, cv2, depth, 0, 100, False, 1, 2)
        self.assertTrue(np.isfinite(result).all())
        self.assertLess(result.max(), 1)

    def test_invalid_controls(self):
        for values in [(0, 100, float("nan"), 0), (10, 5, 1, 0), (0, 100, 0, 0), (0, 100, 1, -1), (0, 100, 1, 101)]:
            with self.subTest(values=values), self.assertRaises(ValueError):
                validate_processing(*values)

    def test_nonfinite_and_flat_maps_are_rejected(self):
        for depth in [np.array([[0, float("nan")]]), np.ones((2, 2))]:
            with self.assertRaises(SystemExit):
                normalize_depth_float(np, cv2, depth, 0, 100, False, 1, 0)

    def test_sequence_uses_global_not_per_frame_normalization(self):
        result = normalize_depths(np, cv2, np.array([[[0, 1]], [[2, 3]]]), 0, 100, False, 1, 0)
        np.testing.assert_allclose(result, [[[0, 1/3]], [[2/3, 1]]], rtol=1e-6)

    def test_natural_order_no_overwrite_limit_and_manifest(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); source = root / "source"; source.mkdir(); output = root / "depth"
            for name in ["frame_10.png", "frame_2.png", "frame_1.png"]:
                (source / name).touch()
            frames = sequence_plan(source, output, "*.png", "depth_", 10)
            self.assertEqual([p.name for p in frames], ["frame_1.png", "frame_2.png", "frame_10.png"])
            with self.assertRaises(ValueError):
                sequence_plan(source, output, "*.png", "../bad", 10)
            with self.assertRaises(ValueError):
                sequence_plan(source, output, "*.png", "depth_", 2)
            with self.assertRaises(ValueError):
                sequence_plan(source, source, "*.png", "depth_", 10)
            output.mkdir(); complete_sequence(output, 3, "vits", "cpu")
            self.assertEqual(json.loads((output / "depth_complete.json").read_text())["frames"], 3)
            with self.assertRaises(ValueError):
                sequence_plan(source, output, "*.png", "depth_", 10)


if __name__ == "__main__":
    unittest.main()
