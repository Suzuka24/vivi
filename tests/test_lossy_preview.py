import sys
import unittest
import zlib
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parents[1] / 'backend'))
from worker import encode_raw_preview


class LossyPreviewTests(unittest.TestCase):
    def test_non_float_and_nonfinite_planes_stay_exact(self):
        for array in (np.arange(12, dtype=np.uint16).reshape(3, 4),
                      np.array([[1, np.nan], [np.inf, -1]], dtype=np.float32)):
            for compress in (False, True):
                with self.subTest(dtype=array.dtype, compress=compress):
                    result = encode_raw_preview(array, compress, 'zfp')
                    self.assertNotIn('lossy', result)
                    payload = zlib.decompress(result['_binary']) if result['codec'] == 'zlib' else result['_binary']
                    if result['shuffle']:
                        payload = np.frombuffer(payload, np.uint8).reshape(array.dtype.itemsize, -1).T.copy().tobytes()
                    self.assertEqual(payload, array.tobytes())

    def test_zfp_absolute_error_and_independent_lossless_stage(self):
        import zfpy
        array = np.linspace(0, 1, 1024, dtype=np.float32).reshape(32, 32)
        for compress in (False, True):
            result = encode_raw_preview(array, compress, 'zfp', 1e-4)
            self.assertEqual(result['lossy']['method'], 'zfp')
            payload = zlib.decompress(result['_binary']) if result['codec'] == 'zlib' else result['_binary']
            decoded = zfpy.decompress_numpy(payload)
            self.assertEqual(decoded.shape, array.shape)
            self.assertLess(np.max(np.abs(decoded - array)), 1e-4)

    def test_block_metadata_retains_float64_range(self):
        array = np.linspace(1e30, 1e30 + 1e25, 130 * 67, dtype=np.float64).reshape(130, 67)
        result = encode_raw_preview(array, False, 'block16')
        self.assertEqual(result['lossy']['limitBytes'], 8)
        self.assertEqual(result['dtype'], '<f8')
        self.assertEqual(result['byteLength'], 3 * 2 * 16 + array.size * 2)


if __name__ == '__main__':
    unittest.main()
