import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
import tifffile

sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))
from axis_layout import make_layout, storage_indices
from worker import Session


class AxisLayoutTests(unittest.TestCase):
    def test_default_layout_folds_extra_axes_into_one_stack(self):
        self.assertEqual(make_layout((15, 15, 90, 90))["targetExpression"], "uv h w")
        self.assertEqual(make_layout((15, 15, 90, 90, 3))["targetExpression"], "uv h w c")

    def test_four_dimensional_fold(self):
        layout = make_layout((15, 15, 90, 90), "", "uv h w")
        self.assertEqual(layout["sourceAxes"], ["u", "v", "h", "w"])
        self.assertEqual(layout["shape"], (225, 90, 90))
        self.assertEqual(layout["frames"], 225)
        indexes = storage_indices(layout, 16, slice(1, 3), slice(2, 4))
        self.assertEqual(indexes[:2], [1, 1])

    def test_leading_rgb_is_presented_channel_last(self):
        layout = make_layout((3, 90, 90))
        self.assertEqual(layout["sourceShape"], [90, 90, 3])
        self.assertEqual(layout["sourceAxes"], ["h", "w", "c"])
        self.assertEqual(layout["channel"], 2)

    def test_channel_can_become_stack_axis(self):
        layout = make_layout((3, 90, 90), "", "c h w")
        self.assertEqual(layout["shape"], (3, 90, 90))
        self.assertIsNone(layout["channel"])
        self.assertEqual(layout["frames"], 3)

    def test_invalid_targets_are_rejected(self):
        for expression in ("u h w", "uv hw", "h uv w", "u v w h"):
            with self.subTest(expression=expression), self.assertRaises(ValueError):
                make_layout((15, 15, 90, 90), "", expression)

    def test_worker_reads_folded_target_frame_without_copying_source(self):
        with tempfile.TemporaryDirectory() as folder:
            data = np.arange(2 * 3 * 4 * 5, dtype=np.float32).reshape(2, 3, 4, 5)
            path = str(Path(folder) / "four-dimensional.tif")
            tifffile.imwrite(path, data, metadata={"axes": "QQYX"})
            session = Session()
            try:
                opened = session.handle({"op": "open", "path": path,
                                         "axisLayouts": {"0": "uv h w"}})
                dataset = opened["datasets"][0]
                self.assertEqual(dataset["shape"], (6, 4, 5))
                self.assertEqual(dataset["frames"], 6)
                value = session.handle({"op": "pixel", "dataset": 0, "frame": 4,
                                        "x": 2, "y": 1})["value"]
                self.assertEqual(value, float(data[1, 1, 1, 2]))
            finally:
                if session.source:
                    session.source.close()


if __name__ == "__main__":
    unittest.main()
