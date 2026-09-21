"""Fixed-format regression corpus: dimensions, axes and original pixel values."""
import sys
import unittest
import base64
import io
import os
from pathlib import Path
from PIL import Image
import numpy as np
import tifffile

sys.path.insert(0, str(Path(__file__).parents[1] / 'backend'))
from worker import Session
from luts import imagej_tables

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
        self.assertEqual(len(imagej_tables()), 68)
        for lut in imagej_tables():
            with self.subTest(lut=lut):
                result=self.session.handle({'op':'render','dataset':0,'frame':0,'size':128,'cmap':lut})
                with Image.open(io.BytesIO(base64.b64decode(result['png']))) as image:
                    self.assertEqual(image.mode,'RGB')
                    self.assertEqual(image.size,(32,24))

    def test_process_filters_on_fixed_image(self):
        self.open('gray.png')
        for action in ('smooth', 'sharpen', 'findEdges', 'invertPixels', 'sqrt',
                       'square', 'log', 'exp', 'abs', 'thresholdBinary',
                       'binaryErode', 'binaryDilate', 'binaryOpen', 'binaryClose', 'fftPower',
                       'mean', 'minimum', 'maximum', 'variance', 'findMaxima',
                       'noiseGaussian', 'saltPepper', 'shadowNorth', 'shadowSouth',
                       'shadowEast', 'shadowWest', 'binaryFillHoles',
                       'fftBandpass'):
            with self.subTest(action=action):
                value=0.05 if action in ('saltPepper','fftBandpass') else 1
                result=self.session.handle({'op':'derive','dataset':0,'frame':0,'action':action,'value':value})
                try:
                    image=tifffile.imread(result['path'])
                    self.assertEqual(image.shape,(24,32))
                    self.assertTrue(np.all(np.isfinite(image)))
                finally:
                    os.unlink(result['path'])
        with self.assertRaisesRegex(ValueError, '8-bit binary'):
            self.session.handle({'op':'derive','dataset':0,'frame':0,'action':'binarySkeleton'})

    def test_image_type_scale_and_rotation(self):
        self.open('gray.png')
        for action,dtype,shape in [('to8',np.uint8,(24,32)),('to16',np.uint16,(24,32)),
                                   ('to32',np.float32,(24,32)),('toRgb',np.uint8,(24,32,3)),
                                   ('rotateLeft',np.uint8,(32,24)),('rotateRight',np.uint8,(32,24)),
                                   ('rotate180',np.uint8,(24,32)),('resize',np.uint8,(48,64))]:
            with self.subTest(action=action):
                result=self.session.handle({'op':'derive','dataset':0,'frame':0,'action':action,'value':2,
                                            'displayLow':0,'displayHigh':255})
                try:
                    image=tifffile.imread(result['path'])
                    self.assertEqual(image.shape,shape)
                    self.assertEqual(image.dtype,dtype)
                finally:
                    os.unlink(result['path'])

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

    def test_four_axis_fits_preserves_other_axis(self):
        info=self.open('four-axis.fits')
        data=info['datasets'][0]
        self.assertEqual(data['shape'], (2, 3, 24, 32))
        self.assertEqual(data['extra'], [0, 1])
        self.assertEqual(data['frames'], 6)
        for frame,expected in [(0,131),(1,231),(2,331),(3,1131),(4,1231),(5,1331)]:
            with self.subTest(frame=frame):
                self.assertEqual(self.pixel(frame=frame),expected)
                self.assertTrue(self.render(frame=frame)['png'])

        section = self.session.handle({'op': 'orthogonal', 'dataset': 0, 'frame': 4,
                                       'axis': 1, 'x': 3, 'y': 4})
        xz = np.frombuffer(base64.b64decode(section['xz']['raw']), np.float32).reshape(3, 32)
        yz = np.frombuffer(base64.b64decode(section['yz']['raw']), np.float32).reshape(24, 3)
        for z in range(3):
            self.assertEqual(xz[z, 3], self.pixel(frame=3 + z, x=3, y=4))
            self.assertEqual(yz[4, z], self.pixel(frame=3 + z, x=3, y=4))

    def test_duplicate_current_slice_range_and_selection(self):
        self.open('stack.tiff')
        cases = [
            ({'frame': 1}, 1, (24, 32)),
            ({'frame': 1, 'selection': {'type': 'roi', 'points': [[2, 3], [7, 9]]}, 'box': [2, 3, 7, 9]}, 1, (6, 5)),
            ({'frame': 1, 'duplicateStack': True, 'first': 2, 'last': 3}, 2, (24, 32)),
            ({'frame': 1, 'selection': {'type': 'roi', 'points': [[2, 3], [7, 9]]}, 'box': [2, 3, 7, 9], 'ignoreSelection': True}, 1, (24, 32)),
        ]
        for args, count, shape in cases:
            with self.subTest(args=args):
                result = self.session.handle({'op': 'duplicate', 'dataset': 0, **args})
                try:
                    with tifffile.TiffFile(result['path']) as copied:
                        self.assertEqual(len(copied.pages), count)
                        array = copied.pages[0].asarray()
                        self.assertEqual(array.shape, shape)
                        source_box=result['box']
                        expected=self.session.source.read(self.session.source.dataset(0),args['frame'],source_box)
                        np.testing.assert_array_equal(array,expected)
                finally:
                    os.unlink(result['path'])

    def test_derived_operations_create_independent_pixels(self):
        self.open('stack.tiff')
        source = self.session.source.read(self.session.source.dataset(0), 1, [0, 0, 32, 24])
        for action, expected in [('flipHorizontal', source[:, ::-1]),
                                 ('flipVertical', source[::-1]),
                                 ('add', source.astype(float) + 5),
                                 ('normalize', (source - source.min()) / (source.max() - source.min()))]:
            with self.subTest(action=action):
                result = self.session.handle({'op': 'derive', 'dataset': 0, 'frame': 1, 'action': action, 'value': 5})
                try:
                    with tifffile.TiffFile(result['path']) as image:
                        np.testing.assert_allclose(image.pages[0].asarray(), expected, rtol=1e-6)
                finally:
                    os.unlink(result['path'])
        projected = self.session.handle({'op': 'derive', 'dataset': 0, 'frame': 1, 'action': 'zMax'})
        try:
            with tifffile.TiffFile(projected['path']) as image:
                planes = [self.session.source.read(self.session.source.dataset(0), frame, [0, 0, 32, 24]) for frame in range(3)]
                np.testing.assert_array_equal(image.pages[0].asarray(), np.maximum.reduce(planes))
        finally:
            os.unlink(projected['path'])

    def test_duplicate_png_fits_and_hyperstack(self):
        for name, args, count in [('gray.png', {'frame': 0}, 1),
                                  ('cube.fits', {'frame': 2, 'duplicateStack': True, 'first': 2, 'last': 3}, 2),
                                  ('hyperstack.tif', {'frame': 4, 'duplicateStack': True, 'first': 2, 'last': 4}, 3)]:
            with self.subTest(name=name):
                self.open(name)
                result = self.session.handle({'op': 'duplicate', 'dataset': 0, **args})
                try:
                    with tifffile.TiffFile(result['path']) as copied:
                        self.assertEqual(len(copied.pages), count)
                        source_frame=args.get('first', args['frame']+1)-1
                        expected=self.session.source.read(self.session.source.dataset(0),source_frame,result['box'])
                        np.testing.assert_allclose(copied.pages[0].asarray(),expected)
                finally:
                    os.unlink(result['path'])

    def test_derived_filters(self):
        self.open('plain.tif')
        source=self.session.source.read(self.session.source.dataset(0),0,[0,0,32,24])
        for action in ('gaussian','median','unsharp'):
            with self.subTest(action=action):
                result=self.session.handle({'op':'derive','dataset':0,'frame':0,'action':action,'value':1})
                try:
                    with tifffile.TiffFile(result['path']) as image:
                        pixels=image.pages[0].asarray()
                        self.assertEqual(pixels.shape,source.shape)
                        self.assertTrue(np.isfinite(pixels).all())
                finally:
                    os.unlink(result['path'])

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
                                      'columns': 2, 'scalePercent': 100})
        self.assertEqual((result['width'], result['height'], result['slices']), (64, 48, 3))
        try:
            image = tifffile.imread(result['path'])
            self.assertEqual(image.dtype, np.uint16)
            source = self.session.source.dataset(0)
            for frame, (y, x) in enumerate(((0, 0), (0, 32), (24, 0))):
                np.testing.assert_array_equal(image[y:y+24, x:x+32],
                                              self.session.source.read(source, frame, [0, 0, 32, 24]))
        finally:
            os.unlink(result['path'])
        profile = self.session.handle({'op': 'profile', 'dataset': 0, 'frame': 0,
                                       'selection': {'type': 'line', 'points': [[0, 0], [10, 0], [10, 10]]},
                                       'points': [0, 0, 10, 10]})
        self.assertAlmostEqual(profile['distance'][-1], 20)


if __name__ == '__main__':
    unittest.main()
