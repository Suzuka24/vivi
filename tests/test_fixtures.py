"""Fixed-format regression corpus: dimensions, axes and original pixel values."""
import sys
import unittest
import base64
import io
from pathlib import Path
from PIL import Image
import numpy as np

sys.path.insert(0, str(Path(__file__).parents[1] / 'backend'))
from worker import Session

FIXTURES = Path(__file__).with_name('fixtures')


class FixtureTests(unittest.TestCase):
    def setUp(self):
        self.session = Session()

    def tearDown(self):
        if self.session.source:
            self.session.source.close()

    def open(self, name):
        return self.session.handle({'op': 'open', 'path': str(FIXTURES / name)})

    def pixel(self, dataset=0, frame=0, x=3, y=4):
        return self.session.handle({'op': 'pixel', 'dataset': dataset, 'frame': frame, 'x': x, 'y': y})['value']

    def render(self, dataset=0, frame=0):
        return self.session.handle({'op': 'render', 'dataset': dataset, 'frame': frame, 'size': 128})

    def test_raster(self):
        for name, kind in [('gray.png', 'raster'), ('color.jpg', 'raster')]:
            with self.subTest(name=name):
                info = self.open(name)
                self.assertEqual(info['kind'], kind)
                self.assertEqual((info['datasets'][0]['width'], info['datasets'][0]['height']), (32, 24))
                self.assertTrue(self.render()['png'])
        self.open('gray.png')
        self.assertEqual(self.pixel(), 131)

    def test_luts_and_zscale_on_fixed_image(self):
        self.open('plain.tif')
        for lut in ('gray', 'fire', 'ice', 'spectrum', 'rgb332', 'red', 'green',
                    'blue', 'cyan', 'magenta', 'yellow', 'redgreen', 'heat', 'cool',
                    'sepia', 'viridis', 'plasma', 'magma', 'inferno', 'turbo'):
            with self.subTest(lut=lut):
                result = self.session.handle({'op': 'render', 'dataset': 0, 'frame': 0,
                                              'size': 128, 'cmap': lut, 'cuts': 'zscale'})
                with Image.open(io.BytesIO(base64.b64decode(result['png']))) as image:
                    self.assertEqual(image.size, (32, 24))
                    self.assertEqual(image.mode, 'L' if lut == 'gray' else 'RGB')

    def test_fractional_rectangle_and_mask(self):
        self.open('gray.png')
        selection = {'type': 'roi', 'points': [[1.25, 2.25], [3.25, 4.25]]}
        measured = self.session.handle({'op': 'measure', 'dataset': 0, 'frame': 0,
                                        'box': [1, 2, 4, 5], 'selection': selection})
        self.assertEqual(measured['count'], 4)
        result = self.session.handle({'op': 'mask', 'dataset': 0, 'frame': 0,
                                      'box': [1, 2, 4, 5], 'selection': selection})
        with Image.open(io.BytesIO(base64.b64decode(result['png']))) as image:
            self.assertEqual(image.mode, 'L')
            self.assertEqual(image.size, (3, 3))
            self.assertEqual(int(np.count_nonzero(np.asarray(image) == 255)), 4)

    def test_tiff_stack_and_hyperstack(self):
        for name, frames, expected in [('plain.tif', 1, 131), ('stack.tiff', 3, 2131), ('hyperstack.tif', 6, 1331)]:
            with self.subTest(name=name):
                info = self.open(name)
                self.assertEqual(info['datasets'][0]['frames'], frames)
                self.assertEqual(self.pixel(frame=frames - 1), expected)
                self.assertTrue(self.render(frame=frames - 1)['png'])

    def test_large_pan_regions(self):
        info = self.open('pan-large.tif')
        self.assertEqual((info['datasets'][0]['width'], info['datasets'][0]['height']), (2400, 1800))
        for box in ([0, 0, 800, 600], [1600, 1200, 2400, 1800], [0, 0, 2400, 1800]):
            result = self.session.handle({'op': 'render', 'dataset': 0, 'frame': 0,
                                          'box': box, 'size': 1600})
            self.assertEqual(result['box'], box)
            self.assertTrue(result['png'])

    def test_fits_hdus_and_cube(self):
        info = self.open('multi-hdu.fits')
        self.assertEqual(len(info['datasets']), 2)
        self.assertEqual(self.pixel(dataset=1), 231)
        self.assertTrue(self.render(dataset=1)['png'])
        info = self.open('cube.fits')
        self.assertEqual(info['datasets'][0]['frames'], 4)
        self.assertEqual(self.pixel(frame=3), 431)
        self.assertTrue(self.render(frame=3)['png'])

    def test_roi_shapes_and_montage(self):
        self.open('stack.tiff')
        full = self.session.handle({'op': 'measure', 'dataset': 0, 'frame': 0, 'box': [0, 0, 20, 20]})
        oval = self.session.handle({'op': 'measure', 'dataset': 0, 'frame': 0, 'box': [0, 0, 20, 20],
                                    'selection': {'type': 'oval', 'points': [[0, 0], [19, 19]]}})
        self.assertLess(oval['count'], full['count'])
        polygon = self.session.handle({'op': 'measure', 'dataset': 0, 'frame': 0, 'box': [0, 0, 20, 20],
                                       'selection': {'type': 'polygon', 'points': [[0, 0], [19, 0], [0, 19]]}})
        self.assertLess(polygon['count'], full['count'])
        result = self.session.handle({'op': 'montage', 'dataset': 0, 'start': 1, 'end': 3,
                                      'columns': 2, 'tile': 64, 'cuts': 'p99', 'stretch': 'sinh'})
        self.assertEqual((result['width'], result['height'], result['slices']), (128, 128, 3))
        self.assertTrue(result['png'])
        image = Image.open(io.BytesIO(base64.b64decode(result['png'])))
        self.assertNotEqual(image.getpixel((30, 30)), (0, 0, 0))
        profile = self.session.handle({'op': 'profile', 'dataset': 0, 'frame': 0,
                                       'selection': {'type': 'line', 'points': [[0, 0], [10, 0], [10, 10]]},
                                       'points': [0, 0, 10, 10]})
        self.assertAlmostEqual(profile['distance'][-1], 20)


if __name__ == '__main__':
    unittest.main()
