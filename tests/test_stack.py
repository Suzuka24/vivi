"""Lossless stack operations on known grayscale values."""
import os
import base64
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np
import tifffile

sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))
from worker import Session


class StackTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.data = np.arange(3 * 4 * 5, dtype=np.uint16).reshape(3, 4, 5) + 1000
        self.source_path = str(Path(self.directory.name) / "source.tif")
        tifffile.imwrite(self.source_path, self.data, photometric="minisblack", metadata={"axes": "TYX"})
        self.session = Session()
        self.session.handle({"op": "open", "path": self.source_path})
        self.addCleanup(lambda: self.session.source.close() if self.session.source else None)

    def call(self, action, **kwargs):
        return self.session.handle({"op": "stack", "action": action, "dataset": 0, **kwargs})

    def test_montage_preserves_uint16_and_scales_by_percent(self):
        for scale, expected in [(100, self.data), (50, self.data[:, ::2, :][:, :, [0, 2]])]:
            result = self.session.handle({"op": "montage", "columns": 2, "scalePercent": scale})
            try:
                image = tifffile.imread(result["path"])
                self.assertEqual(image.dtype, np.uint16)
                h, w = expected.shape[1:]
                self.assertEqual(image.shape, (2*h, 2*w))
                for index, (row, col) in enumerate(((0, 0), (0, 1), (1, 0))):
                    np.testing.assert_array_equal(image[row*h:(row+1)*h, col*w:(col+1)*w], expected[index])
                self.assertTrue(np.all(image[h:, w:] == 0))
            finally:
                os.unlink(result["path"])

    def test_images_to_stack_and_stack_to_images(self):
        inputs = []
        for index, image in enumerate(self.data):
            path = str(Path(self.directory.name) / f"image-{index}.tif")
            tifffile.imwrite(path, image)
            inputs.append(path)
        result = self.call("imagesToStack", paths=inputs)
        try:
            np.testing.assert_array_equal(tifffile.imread(result["path"]), self.data)
            self.assertEqual(result["frames"], 3)
        finally:
            os.unlink(result["path"])
        result = self.call("stackToImages", start=2, end=3)
        try:
            self.assertEqual(result["frames"], [2, 3])
            for path, expected in zip(result["paths"], self.data[1:]):
                np.testing.assert_array_equal(tifffile.imread(path), expected)
        finally:
            for path in result["paths"]:
                os.unlink(path)

    def test_reslice_profile_and_statistics(self):
        for axis, position, expected in (("x", 2, self.data[:, :, 2]),
                                         ("y", 1, self.data[:, 1, :])):
            result = self.call("reslice", axis=axis, position=position)
            try:
                np.testing.assert_array_equal(tifffile.imread(result["path"]), expected)
            finally:
                os.unlink(result["path"])
        profile = self.call("zAxisProfile", x=2, y=1)
        self.assertEqual(profile["frames"], [1, 2, 3])
        self.assertEqual(profile["values"], self.data[:, 1, 2].tolist())
        measured = self.call("measureStack", box=[1, 1, 3, 3])
        self.assertEqual([item["count"] for item in measured["results"]], [4, 4, 4])
        stats = self.call("statistics", box=[1, 1, 3, 3])
        values = self.data[:, 1:3, 1:3].astype(float)
        self.assertEqual(stats["count"], values.size)
        self.assertAlmostEqual(stats["mean"], values.mean())
        self.assertAlmostEqual(stats["std"], values.std())
        self.assertEqual(stats["min"], values.min())
        self.assertEqual(stats["max"], values.max())

    def test_orthogonal_sections_keep_original_values_and_axes(self):
        result = self.session.handle({"op": "orthogonal", "dataset": 0, "frame": 1,
                                      "axis": 0, "x": 2, "y": 1})
        self.assertEqual((result["xz"]["width"], result["xz"]["height"]), (5, 3))
        self.assertEqual((result["yz"]["width"], result["yz"]["height"]), (4, 3))
        xz = np.frombuffer(base64.b64decode(result["xz"]["raw"]), np.float32).reshape(3, 5)
        yz = np.frombuffer(base64.b64decode(result["yz"]["raw"]), np.float32).reshape(3, 4)
        np.testing.assert_array_equal(xz, self.data[:, 1, :])
        np.testing.assert_array_equal(yz, self.data[:, :, 2])
        with self.assertRaisesRegex(ValueError, "outside"):
            self.session.handle({"op": "orthogonal", "dataset": 0, "x": 5, "y": 1})

    def test_invalid_range_and_mixed_image_dtype(self):
        with self.assertRaises(ValueError):
            self.call("stackToImages", start=3, end=4)
        paths = []
        for index, dtype in enumerate((np.uint8, np.uint16)):
            path = str(Path(self.directory.name) / f"mixed-{index}.tif")
            tifffile.imwrite(path, self.data[0].astype(dtype))
            paths.append(path)
        with self.assertRaisesRegex(ValueError, "matching shape and dtype"):
            self.call("imagesToStack", paths=paths)

    def test_histogram_parameters_and_statistics(self):
        result = self.session.handle({"op": "histogram", "dataset": 0, "frame": 0})
        self.assertEqual(len(result["counts"]), 256)
        self.assertEqual(result["samples"], 20)
        self.assertEqual(result["min"], 1000)
        self.assertEqual(result["max"], 1019)
        self.assertAlmostEqual(result["mean"], self.data[0].mean())
        self.assertAlmostEqual(result["std"], self.data[0].std())
        limited = self.session.handle({"op": "histogram", "bins": 2, "xMin": 1000,
                                       "xMax": 1010, "dataset": 0, "frame": 0})
        self.assertEqual(limited["counts"], [5, 6])
        self.assertEqual(limited["edges"], [1000, 1005, 1010])
        self.assertEqual(limited["modeCount"], 6)
        self.assertEqual(limited["binWidth"], 5)

    def test_fft_imagej_padding_keeps_original_fft_action(self):
        for action, shape in (("fftPower", (4, 5)), ("fftPowerImageJ", (4, 8))):
            result = self.session.handle({"op": "derive", "action": action, "dataset": 0, "frame": 0})
            try:
                actual = tifffile.imread(result["path"])
                expected = np.log1p(np.abs(np.fft.fftshift(np.fft.fft2(self.data[0], s=shape))))
                self.assertEqual(actual.shape, shape)
                np.testing.assert_allclose(actual, expected)
            finally:
                os.unlink(result["path"])

    def test_equalize_histogram_preserves_shape_and_dtype(self):
        result = self.session.handle({"op": "derive", "action": "equalizeHistogram", "dataset": 0, "frame": 0})
        try:
            image = tifffile.imread(result["path"])
            self.assertEqual(image.shape, self.data[0].shape)
            self.assertEqual(image.dtype, self.data.dtype)
            self.assertGreaterEqual(image.min(), self.data[0].min())
            self.assertLessEqual(image.max(), self.data[0].max())
        finally:
            os.unlink(result["path"])

    def test_transform_preserves_stack_and_pixel_values(self):
        result = self.session.handle({"op": "derive", "action": "rotateRight", "dataset": 0,
                                      "frame": 1, "preserveStack": True})
        try:
            actual = tifffile.imread(result["path"])
            self.assertEqual(actual.dtype, self.data.dtype)
            self.assertEqual(actual.shape, (3, 5, 4))
            np.testing.assert_array_equal(actual, np.rot90(self.data, 3, axes=(1, 2)))
        finally:
            os.unlink(result["path"])

    def test_transform_preserves_hyperstack_axes(self):
        data = np.arange(2 * 3 * 4 * 5, dtype=np.float32).reshape(2, 3, 4, 5)
        path = str(Path(self.directory.name) / "hyper.tif")
        tifffile.imwrite(path, data, metadata={"axes": "QQYX"})
        self.session.handle({"op": "open", "path": path})
        result = self.session.handle({"op": "derive", "action": "rotateLeft", "dataset": 0,
                                      "frame": 2, "preserveStack": True})
        try:
            with tifffile.TiffFile(result["path"]) as transformed:
                self.assertEqual(transformed.series[0].axes, "QQYX")
                self.assertEqual(transformed.series[0].shape, (2, 3, 5, 4))
            np.testing.assert_array_equal(tifffile.imread(result["path"]), np.rot90(data, 1, axes=(2, 3)))
        finally:
            os.unlink(result["path"])

    def test_split_rgb_channels_and_lut_preview(self):
        rgb = np.stack((self.data[0], self.data[0] + 100, self.data[0] + 200), axis=-1)
        path = str(Path(self.directory.name) / "rgb.tif")
        tifffile.imwrite(path, rgb, photometric="rgb")
        self.session.handle({"op": "open", "path": path})
        for index, action in enumerate(("channelRed", "channelGreen", "channelBlue")):
            result = self.session.handle({"op": "derive", "action": action})
            try:
                actual = tifffile.imread(result["path"])
                self.assertEqual(actual.dtype, rgb.dtype)
                np.testing.assert_array_equal(actual, rgb[..., index])
            finally:
                os.unlink(result["path"])
        preview = self.session.handle({"op": "lutPreview", "cmap": "gray"})
        self.assertEqual(len(preview["rgb"]), 256)
        self.assertEqual(preview["rgb"][0], [0, 0, 0])
        self.assertEqual(preview["rgb"][-1], [255, 255, 255])
        with self.assertRaisesRegex(ValueError, "Unknown LUT"):
            self.session.handle({"op": "lutPreview", "cmap": "missing"})


if __name__ == "__main__":
    unittest.main()
