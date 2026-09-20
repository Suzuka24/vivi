"""Optional lossy encoding for floating-point preview planes only."""
import math

import numpy as np


METHODS = {'zfp', 'float16', 'bfloat16', 'block8', 'block12', 'block16'}
BLOCK = 64


def encode_lossy(raw, method, relative_tolerance=1e-4):
    if method not in METHODS:
        raise ValueError(f'Unknown lossy preview method: {method}')
    array = np.asarray(raw)
    if array.ndim != 2 or array.dtype.kind != 'f' or array.dtype.itemsize not in (4, 8):
        return None
    if not np.isfinite(array).all():
        return None  # Preserve NaNs and infinities exactly through the ordinary raw path.
    native = np.ascontiguousarray(array.astype(np.dtype('f' + str(array.dtype.itemsize)), copy=False))
    low, high = float(native.min()), float(native.max())
    span = high - low
    if not math.isfinite(span) or span <= 0:
        return None
    meta = {'method': method, 'originalDtype': array.dtype.str}

    if method == 'zfp':
        try:
            import zfpy
        except ImportError as error:
            raise RuntimeError('ZFP previews require zfpy in vivi.pythonPath; install backend/requirements.txt') from error
        tolerance = float(relative_tolerance)
        if not math.isfinite(tolerance) or not 0 < tolerance <= 0.1:
            raise ValueError('Lossy relative tolerance must be between 0 and 0.1')
        meta['absoluteTolerance'] = span * tolerance
        return bytes(zfpy.compress_numpy(native, tolerance=meta['absoluteTolerance'])), native.dtype.str, 1, meta

    if method == 'float16':
        if max(abs(low), abs(high)) > np.finfo(np.float16).max:
            return None
        quantized = native.astype('<f2')
        return quantized.tobytes(), quantized.dtype.str, 2, meta

    if method == 'bfloat16':
        if max(abs(low), abs(high)) > np.finfo(np.float32).max:
            return None
        floats = native.astype('<f4')
        bits = floats.view('<u4')
        rounded = (bits + np.uint32(0x7fff) + ((bits >> 16) & 1)).astype('<u4')
        if not np.isfinite(rounded.view('<f4')).all():
            return None
        return (rounded >> 16).astype('<u2').tobytes(), '<u2', 2, meta

    bits = int(method.removeprefix('block'))
    levels = (1 << bits) - 1
    height, width = native.shape
    codes = np.empty((height, width), dtype=np.uint16)
    limits = []
    for y in range(0, height, BLOCK):
        for x in range(0, width, BLOCK):
            tile = native[y:y + BLOCK, x:x + BLOCK]
            minimum, maximum = float(tile.min()), float(tile.max())
            limits.extend((minimum, maximum))
            if maximum > minimum:
                codes[y:y + BLOCK, x:x + BLOCK] = np.rint(
                    (tile.astype(np.float64) - minimum) * (levels / (maximum - minimum))
                ).clip(0, levels).astype(np.uint16)
            else:
                codes[y:y + BLOCK, x:x + BLOCK] = 0
    header = np.asarray(limits, dtype='<f4' if native.dtype.itemsize == 4 else '<f8').tobytes()
    values = codes.ravel()
    if bits == 8:
        packed = values.astype(np.uint8).tobytes()
    elif bits == 16:
        packed = values.astype('<u2').tobytes()
    else:
        if values.size % 2:
            values = np.pad(values, (0, 1))
        pairs = values.reshape(-1, 2)
        out = np.empty((len(pairs), 3), dtype=np.uint8)
        out[:, 0] = pairs[:, 0] & 255
        out[:, 1] = (pairs[:, 0] >> 8) | ((pairs[:, 1] & 15) << 4)
        out[:, 2] = pairs[:, 1] >> 4
        packed = out.tobytes()
    meta.update(blockSize=BLOCK, limitBytes=4 if native.dtype.itemsize == 4 else 8)
    return header + packed, native.dtype.str, 1, meta
