"""Folder image sequences retain natural order, labels and original pixel values."""
import base64
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parents[1] / 'backend'))
from worker import Session


class SequenceTests(unittest.TestCase):
    def test_folder_becomes_a_labeled_lazy_stack(self):
        with tempfile.TemporaryDirectory() as folder:
            for name, value in [('slice10.png', 10), ('slice2.png', 2), ('slice1.png', 1)]:
                Image.fromarray(np.full((3, 4), value, dtype=np.uint8)).save(Path(folder) / name)
            session = Session()
            try:
                info = session.handle({'op': 'open', 'path': folder})
                self.assertEqual(info['kind'], 'sequence')
                self.assertEqual(info['datasets'][0]['frames'], 3)
                self.assertEqual(info['sliceLabels'], ['slice1.png', 'slice2.png', 'slice10.png'])
                for index, expected in enumerate((1, 2, 10)):
                    pixel = session.handle({'op': 'pixel', 'frame': index, 'x': 1, 'y': 1})
                    self.assertEqual(pixel['value'], expected)
                preview = session.handle({'op': 'render', 'frame': 2, 'raw': True, 'cuts': 'manual',
                                          'low': 0, 'high': 10, 'size': 128})
                values = np.frombuffer(base64.b64decode(preview['raw']), dtype=np.float32)
                self.assertEqual(preview['channels'], 1)
                np.testing.assert_array_equal(values, 10)
            finally:
                if session.source:
                    session.source.close()


if __name__ == '__main__':
    unittest.main()
