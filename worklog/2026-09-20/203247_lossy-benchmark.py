"""Benchmark preview codecs on the specified 101-slice TIFF; write CSV to stdout."""
import csv
import sys
import time
import zlib

import numpy as np
import pysz
import tifffile
import zfpy
from lossy_preview import encode_lossy

SOURCE = ('/home/disk1/hyh/Project/UFL-cdx/data/260823_wxg_data/'
          's13_naomiv2_sum_rep00_density03_n04_81views_multigpu/'
          'python_h_rl_allviews_iter1000/naomiv2_sum_rep00_density03_n04.tif')
METHODS = ('lossless', 'zfp-1e-4', 'zfp-1e-5', 'sz3-1e-4', 'sz3-1e-5',
           'float16', 'bfloat16', 'block8', 'block12', 'block16')


def decode_blocks(data, shape, method, meta):
    bits = int(method[5:])
    height, width = shape
    limit_bytes = meta['limitBytes']
    block_count = ((height + 63) // 64) * ((width + 63) // 64)
    limits = np.frombuffer(data, count=block_count * 2,
                           dtype='<f4' if limit_bytes == 4 else '<f8').reshape(-1, 2)
    payload = data[block_count * 2 * limit_bytes:]
    count = height * width
    if bits == 8:
        codes = np.frombuffer(payload, np.uint8, count=count).astype(np.uint16)
    elif bits == 16:
        codes = np.frombuffer(payload, dtype='<u2', count=count)
    else:
        packed = np.frombuffer(payload, np.uint8).reshape(-1, 3)
        codes = np.empty(packed.shape[0] * 2, np.uint16)
        codes[0::2] = packed[:, 0].astype(np.uint16) | ((packed[:, 1] & 15).astype(np.uint16) << 8)
        codes[1::2] = (packed[:, 1] >> 4).astype(np.uint16) | (packed[:, 2].astype(np.uint16) << 4)
        codes = codes[:count]
    codes = codes.reshape(shape)
    restored = np.empty(shape, np.float32)
    index = 0
    for y in range(0, height, 64):
        for x in range(0, width, 64):
            low, high = limits[index]
            index += 1
            restored[y:y + 64, x:x + 64] = low + codes[y:y + 64, x:x + 64] * (high - low) / ((1 << bits) - 1)
    return restored


def main():
    writer = csv.writer(sys.stdout, lineterminator='\n')
    writer.writerow(('slice', 'method', 'source_bytes', 'encoded_bytes', 'wire_bytes',
                     'max_abs_error', 'rmse', 'encode_ms', 'zlib_ms', 'decode_ms', 'min', 'max'))
    with tifffile.TiffFile(SOURCE) as file:
        for frame in range(101):
            image = file.series[0].asarray(key=frame)
            low, high = float(image.min()), float(image.max())
            span = high - low
            for method in METHODS:
                start = time.perf_counter()
                if method == 'lossless':
                    encoded = np.frombuffer(image.tobytes(), np.uint8).reshape(-1, 4).T.copy().tobytes()
                    restored = image
                elif method.startswith('sz3'):
                    config = pysz.szConfig()
                    config.errorBoundMode = pysz.szErrorBoundMode.ABS
                    config.absErrorBound = span * float(method.split('-', 1)[1])
                    encoded, _ = pysz.sz.compress(image, config)
                    encoded = bytes(encoded)
                else:
                    name, _, tolerance = method.partition('-')
                    encoded, _, _, meta = encode_lossy(image, name, float(tolerance) if tolerance else 1e-4)
                    if method in ('float16', 'bfloat16'):
                        encoded = np.frombuffer(encoded, np.uint8).reshape(-1, 2).T.copy().tobytes()
                encode_ms = (time.perf_counter() - start) * 1000
                start = time.perf_counter()
                packed = zlib.compress(encoded, 1)
                zlib_ms = (time.perf_counter() - start) * 1000
                start = time.perf_counter()
                if method == 'lossless':
                    pass
                elif method.startswith('zfp'):
                    restored = zfpy.decompress_numpy(encoded)
                elif method.startswith('sz3'):
                    restored, _ = pysz.sz.decompress(np.frombuffer(encoded, np.uint8), np.float32, image.shape)
                elif method == 'float16':
                    raw = np.frombuffer(encoded, np.uint8).reshape(2, -1).T.copy().tobytes()
                    restored = np.frombuffer(raw, '<f2').astype(np.float32).reshape(image.shape)
                elif method == 'bfloat16':
                    raw = np.frombuffer(encoded, np.uint8).reshape(2, -1).T.copy().tobytes()
                    restored = (np.frombuffer(raw, '<u2').astype(np.uint32) << 16).view(np.float32).reshape(image.shape)
                else:
                    restored = decode_blocks(encoded, image.shape, method, meta)
                decode_ms = (time.perf_counter() - start) * 1000
                error = restored.astype(np.float64) - image.astype(np.float64)
                writer.writerow((frame + 1, method, image.nbytes, len(encoded), min(len(encoded), len(packed)),
                                 float(np.max(np.abs(error))), float(np.sqrt(np.mean(error * error))),
                                 round(encode_ms, 3), round(zlib_ms, 3), round(decode_ms, 3), low, high))
            if frame % 20 == 0:
                sys.stdout.flush()


if __name__ == '__main__':
    main()
