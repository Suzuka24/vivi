import sys
import unittest
import zlib
import tempfile
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parents[1] / 'backend'))
from worker import encode_raw_preview
from worker import Source, Session


class RawTransportTests(unittest.TestCase):
    def test_source_dtype_and_bytes_survive_both_modes(self):
        arrays = [np.array([0, 1, 255], dtype=np.uint8),
                  np.array([0, 256, 65535], dtype=np.uint16),
                  np.array([1, -2], dtype='>i4'),
                  np.array([0.125, np.nan, np.inf], dtype=np.float32),
                  np.array([np.pi, 1e-200], dtype=np.float64),
                  np.array([2**53 + 1], dtype=np.int64)]
        for array in arrays:
            for compress in (False, True):
                with self.subTest(dtype=array.dtype, compress=compress):
                    result = encode_raw_preview(array, compress)
                    payload = result['_binary']
                    if result['codec'] == 'zlib':
                        payload = zlib.decompress(payload)
                    if result['shuffle']:
                        payload = np.frombuffer(payload, np.uint8).reshape(array.dtype.itemsize, -1).T.copy().tobytes()
                    self.assertEqual(payload, array.tobytes())
                    self.assertEqual(result['dtype'], array.dtype.str)
                    if not compress:
                        self.assertEqual(result['codec'], 'none')

    def test_zstd_shuffle_round_trip_preserves_source_bytes(self):
        import imagecodecs
        array = np.linspace(-3, 7, 257, dtype=np.float32)
        result = encode_raw_preview(array, True, lossless_method='zstd1-shuffle')
        payload = imagecodecs.zstd_decode(result['_binary'])
        if result['shuffle']:
            payload = np.frombuffer(payload, np.uint8).reshape(array.dtype.itemsize, -1).T.copy().tobytes()
        self.assertEqual(result['codec'], 'zstd')
        self.assertEqual(payload, array.tobytes())

    def test_fits_scaling_keeps_stored_dtype_on_wire(self):
        from astropy.io import fits
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'scaled.fits'
            hdu = fits.PrimaryHDU(np.array([[1, 2], [3, -32768]], dtype=np.int16))
            hdu.header['BSCALE'] = 2
            hdu.header['BZERO'] = 10
            hdu.header['BLANK'] = -32768
            hdu.writeto(path)
            source = Source(str(path))
            try:
                dataset = source.datasets[0]
                stored = source.read(dataset, 0, [0, 0, 2, 2], raw_stored=True)
                scaled = source.read(dataset, 0, [0, 0, 2, 2])
                self.assertEqual(stored.dtype.str, '>i2')
                np.testing.assert_array_equal(stored, [[1, 2], [3, -32768]])
                np.testing.assert_array_equal(scaled[:1], [[12, 14]])
                self.assertTrue(np.isnan(scaled[1, 1]))
            finally:
                source.close()
            session = Session()
            try:
                session.handle({'op': 'open', 'path': str(path)})
                preview = session.handle({'op': 'render', 'raw': True, 'binary': True,
                                          'cuts': 'manual', 'low': 10, 'high': 20})
                self.assertEqual(preview['dtype'], '>i2')
                self.assertEqual(preview['bscale'], 2)
                self.assertEqual(preview['bzero'], 10)
                self.assertEqual(preview['blank'], '-32768')
            finally:
                if session.source:
                    session.source.close()


if __name__ == '__main__':
    unittest.main()
