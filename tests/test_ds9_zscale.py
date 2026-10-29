import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))
from ds9_zscale import ds9_zscale


class Ds9ZScaleTests(unittest.TestCase):
    def test_ds9_menu_defaults_and_outlier_rejection(self):
        height, width = 24, 32
        y, x = np.indices((height, width))
        image = (x + y * 0.1).astype(np.float32)
        image[0, 0] = 100000
        low, high = ds9_zscale(image)
        self.assertAlmostEqual(low, 0.20000000298023224, places=12)
        self.assertAlmostEqual(high, 80.22047767759199, places=10)

    def test_empty_and_constant_images(self):
        self.assertEqual(ds9_zscale(np.full((4, 4), np.nan)), (0.0, 1.0))
        self.assertEqual(ds9_zscale(np.full((4, 4), 7, dtype=np.int16)), (7.0, 7.0))


if __name__ == "__main__":
    unittest.main()
