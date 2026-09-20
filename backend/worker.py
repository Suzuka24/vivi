"""One read-only image session per process. JSON lines over stdio; no HTTP server."""
import base64
import io
import json
import math
import os
import re
import sys
import tempfile
import warnings

import numpy as np
from PIL import Image, ImageDraw
from luts import apply_lut


def finite_number(value, default):
    value = float(default if value is None else value)
    if not math.isfinite(value):
        raise ValueError("Expected a finite number")
    return value


class Source:
    def __init__(self, path, max_pixels=64_000_000):
        self.path = os.path.abspath(os.path.expanduser(path))
        self.handles = []
        self.datasets = []
        self.levels = {}
        self.max_pixels = max_pixels
        self.frame_cache = None
        self.frame_index = -1
        self.sequence_source = None
        self.sequence_index = -1
        self.slice_labels = None
        self.warning = ""
        try:
            self._open()
        except Exception:
            self.close()
            raise

    def _open(self):
        if os.path.isdir(self.path):
            extensions = ('.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.gif', '.fits', '.fit', '.fts', '.fz')
            files = [entry.path for entry in os.scandir(self.path) if entry.is_file() and entry.name.lower().endswith(extensions)]
            files.sort(key=lambda name: [int(part) if part.isdigit() else part.casefold() for part in re.split(r'(\d+)', os.path.basename(name))])
            if not files:
                raise ValueError('Folder contains no supported images')
            first = Source(files[0], self.max_pixels)
            try:
                d = first.datasets[0]
                if d['frames'] != 1:
                    raise ValueError('Image Sequence requires one plane per file')
                self.kind = 'sequence'
                self.sequence_files = files
                self.slice_labels = [os.path.basename(file) for file in files]
                self.sequence_shape = (d['width'], d['height'], d['dtype'], d['channel'] is not None)
                shape = (len(files), d['height'], d['width']) + ((first.source_channels(d),) if d['channel'] is not None else ())
                self._add(0, 'Image Sequence', shape, 'TYXS' if d['channel'] is not None else 'TYX', d['dtype'])
                self.warning = 'Image Sequence reads each file as a slice and retains its filename as a slice label.'
            finally:
                first.close()
            return
        ext = os.path.splitext(self.path)[1].lower()
        if ext in (".fits", ".fit", ".fts", ".fz"):
            from astropy.io import fits
            # section performs physical-value scaling only on the requested subset.
            self.kind = "fits"
            self.file = fits.open(self.path, memmap=False, lazy_load_hdus=True)
            self.handles.append(self.file)
            with open(self.path, "rb") as stream:
                self.plain_fits = stream.read(6) == b"SIMPLE"
            for i, hdu in enumerate(self.file):
                if isinstance(hdu, (fits.PrimaryHDU, fits.ImageHDU, fits.CompImageHDU)) and len(hdu.shape or ()) >= 2:
                    self._add(i, f"HDU {i}: {hdu.name}", hdu.shape, "", str(hdu.header.get("BITPIX")))
        elif ext in (".tif", ".tiff"):
            import tifffile
            self.kind = "tiff"
            self.file = tifffile.TiffFile(self.path)
            self.handles.append(self.file)
            for i, series in enumerate(self.file.series):
                self._add(i, f"Series {i}: {series.axes}", series.shape, series.axes, str(series.dtype))
            self.warning = "TIFF uses chunk/region reads and pyramid levels where available; compressed strips may still require substantial server I/O."
        elif ext in (".avi", ".mp4", ".mov", ".mkv"):
            import cv2
            self.kind = "video"
            self.file = cv2.VideoCapture(self.path)
            if not self.file.isOpened():
                self.file.release()
                raise ValueError("Video codec unavailable or file cannot be opened")
            self.handles.append(self.file)
            w, h = int(self.file.get(cv2.CAP_PROP_FRAME_WIDTH)), int(self.file.get(cv2.CAP_PROP_FRAME_HEIGHT))
            self._guard(w * h)
            count = max(1, int(self.file.get(cv2.CAP_PROP_FRAME_COUNT)))
            self._add(0, "Video", (count, h, w, 3), "TYXS", "uint8")
            self.warning = "Video is decoded on the server; scrubbing is codec/keyframe dependent. Preview playback has no audio."
        else:
            self.kind = "raster"
            # Keep Pillow's decompression-bomb protection in addition to our limit.
            self.file = Image.open(self.path)
            self.handles.append(self.file)
            w, h = self.file.size
            self._guard(w * h)
            count = getattr(self.file, "n_frames", 1)
            color = self.file.mode not in ("1", "L", "I", "F", "I;16", "I;16B", "I;16L")
            self.raster_color = color
            shape = (count, h, w, 3) if color else (count, h, w)
            self._add(0, "Image", shape, "TYXS" if color else "TYX", self.file.mode)
            self.warning = "PNG/JPEG/GIF are fully decoded on the server (one frame cached); only the preview crosses SSH."
        if not self.datasets:
            raise ValueError("No supported 2D image planes in this file")

    def _guard(self, pixels):
        if pixels > self.max_pixels:
            raise ValueError(f"Full-frame decoder requires {pixels:,} pixels, above maxDecodedPixels={self.max_pixels:,}. Use tiled TIFF/FITS or explicitly increase the limit.")

    def _add(self, key, name, shape, axes, dtype):
        shape = tuple(int(v) for v in shape)
        if any(v < 1 for v in shape):
            return
        if axes:
            if "Y" not in axes or "X" not in axes:
                return
            y, x = axes.index("Y"), axes.index("X")
            c = axes.index("S") if "S" in axes and shape[axes.index("S")] in (3, 4) else None
        else:
            y, x, c = len(shape) - 2, len(shape) - 1, None
        extra = [i for i in range(len(shape)) if i not in (y, x, c)]
        self.datasets.append(dict(id=key, name=name, shape=shape, axes=axes, dtype=dtype,
                                  width=shape[x], height=shape[y], frames=math.prod(shape[i] for i in extra),
                                  y=y, x=x, channel=c, extra=extra))

    def dataset(self, key=0):
        return next((d for d in self.datasets if d["id"] == int(key)), self.datasets[0])

    @staticmethod
    def source_channels(d):
        return d['shape'][d['channel']] if d['channel'] is not None else 1

    def read(self, d, frame, box, step=1, pyramid=False):
        frame = int(frame)
        if not 0 <= frame < d["frames"]:
            raise ValueError("Frame out of range")
        x0, y0, x1, y1 = box
        if self.kind == 'sequence':
            if frame != self.sequence_index:
                if self.sequence_source:
                    self.sequence_source.close()
                self.sequence_source = Source(self.sequence_files[frame], self.max_pixels)
                self.sequence_index = frame
                item = self.sequence_source.datasets[0]
                if item['frames'] != 1 or (item['width'], item['height'], item['dtype'], item['channel'] is not None) != self.sequence_shape:
                    raise ValueError(f'Image Sequence slice differs in size, type, or channels: {self.slice_labels[frame]}')
            return self.sequence_source.read(self.sequence_source.datasets[0], 0, box, step, pyramid)
        if self.kind in ("raster", "video"):
            if self.frame_index != frame:
                if self.kind == "video":
                    import cv2
                    if frame != self.frame_index + 1:
                        self.file.set(cv2.CAP_PROP_POS_FRAMES, frame)
                    ok, data = self.file.read()
                    if not ok:
                        raise ValueError(f"Unable to decode video frame {frame}")
                    self._guard(data.shape[0] * data.shape[1])
                    self.frame_cache = cv2.cvtColor(data, cv2.COLOR_BGR2RGB)
                else:
                    self.file.seek(frame)
                    self.frame_cache = np.array(self.file.convert("RGB") if self.raster_color else self.file)
                self.frame_index = frame
            return self.frame_cache[y0:y1:step, x0:x1:step]
        shape = d["shape"]
        target = None
        if self.kind == "tiff":
            import zarr
            import tifffile
            series = self.file.series[d["id"]]
            level = 0
            if pyramid:
                for i, candidate in enumerate(series.levels):
                    factor = d["width"] / candidate.shape[d["x"]]
                    if factor <= step:
                        level = i
            cache_key = (d["id"], level)
            if cache_key not in self.levels:
                try:
                    mapped = tifffile.memmap(self.path, series=d["id"], level=level, mode="r")
                    self.levels[cache_key] = mapped
                    self.handles.append(mapped._mmap)
                except ValueError:
                    # Explicit level=0 is essential: aszarr() on the base series
                    # otherwise returns a group containing the whole pyramid.
                    store = series.aszarr(level=level)
                    self.handles.append(store)
                    self.levels[cache_key] = zarr.open(store, mode="r")
            target = self.levels[cache_key]
            shape = target.shape
            fx, fy = d["width"] / shape[d["x"]], d["height"] / shape[d["y"]]
            x0, x1 = int(x0 / fx), min(shape[d["x"]], math.ceil(x1 / fx))
            y0, y1 = int(y0 / fy), min(shape[d["y"]], math.ceil(y1 / fy))
            step = max(1, int(step / max(fx, fy)))
        indices = [slice(None)] * len(shape)
        frame_shape = tuple(d["shape"][i] for i in d["extra"])
        coordinates = np.unravel_index(frame, frame_shape) if frame_shape else ()
        for axis, coord in zip(d["extra"], coordinates):
            indices[axis] = int(coord)
        indices[d["y"]], indices[d["x"]] = slice(y0, y1, step), slice(x0, x1, step)
        if self.kind == "fits":
            from astropy.io import fits
            hdu = self.file[d["id"]]
            if self.plain_fits and not isinstance(hdu, fits.CompImageHDU):
                # Astropy section with two strides may issue one read per pixel.
                # mmap creates an address-space view, not a full resident copy.
                key = ("fits", d["id"])
                if key not in self.levels:
                    dtype = {8:"u1",16:">i2",32:">i4",64:">i8",-32:">f4",-64:">f8"}[hdu.header["BITPIX"]]
                    mapped = np.memmap(self.path, mode="r", dtype=dtype, shape=d["shape"], offset=hdu.fileinfo()["datLoc"])
                    self.levels[key] = mapped
                    self.handles.append(mapped._mmap)
                raw = self.levels[key][tuple(indices)]
                bscale, bzero, blank = hdu.header.get("BSCALE",1), hdu.header.get("BZERO",0), hdu.header.get("BLANK")
                if bscale != 1 or bzero != 0 or (blank is not None and raw.dtype.kind in "iu"):
                    data = raw.astype(np.float64) * bscale + bzero
                    if blank is not None and raw.dtype.kind in "iu":
                        data[raw == blank] = np.nan
                else:
                    data = raw
            else:
                data = hdu.section[tuple(indices)]
        else:
            data = target[tuple(indices)]
        remaining = [i for i in range(len(shape)) if i not in d["extra"]]
        order = [remaining.index(d["y"]), remaining.index(d["x"])]
        if d["channel"] is not None:
            order.append(remaining.index(d["channel"]))
        return np.transpose(np.asarray(data), order)

    def close(self):
        if self.sequence_source:
            self.sequence_source.close()
            self.sequence_source = None
        self.frame_cache = None
        self.levels.clear()
        for handle in reversed(self.handles):
            try:
                (handle.release if hasattr(handle, "release") else handle.close)()
            except Exception:
                pass
        self.handles.clear()


def bounds(d, value=None):
    value = value or [0, 0, d["width"], d["height"]]
    if len(value) != 4:
        raise ValueError("Expected [x0,y0,x1,y1]")
    x0, y0, x1, y1 = [finite_number(v, 0) for v in value]
    x0, x1 = sorted((x0, x1))
    y0, y1 = sorted((y0, y1))
    x0, y0 = max(0, min(d["width"] - 1, math.floor(x0))), max(0, min(d["height"] - 1, math.floor(y0)))
    return [x0, y0, max(x0 + 1, min(d["width"], math.ceil(x1))), max(y0 + 1, min(d["height"], math.ceil(y1)))]


def scalar(data):
    a = np.asarray(data, dtype=np.float64)
    return a[..., :3].mean(axis=-1) if a.ndim == 3 else a


def selection_mask(selection, box, shape, step=1):
    if not selection or selection.get("type") not in ("roi", "oval", "polygon", "freehand"):
        return np.ones(shape, dtype=bool)
    points = np.asarray(selection.get("points", []), dtype=float)
    if points.ndim != 2 or points.shape[1] != 2 or len(points) < 2:
        return np.ones(shape, dtype=bool)
    ys, xs = np.ogrid[:shape[0], :shape[1]]
    x = box[0] + (xs + .5) * step
    y = box[1] + (ys + .5) * step
    if selection["type"] == "roi":
        left, right = sorted((points[0, 0], points[1, 0]))
        top, bottom = sorted((points[0, 1], points[1, 1]))
        if selection.get("variant") != "rounded":
            return (x >= left) & (x < right) & (y >= top) & (y < bottom)
        radius = .15 * min(right - left, bottom - top)
        center_x = np.clip(x, left + radius, right - radius)
        center_y = np.clip(y, top + radius, bottom - radius)
        return (x - center_x) ** 2 + (y - center_y) ** 2 <= radius ** 2
    if selection["type"] == "oval":
        left, right = sorted((points[0, 0], points[1, 0]))
        top, bottom = sorted((points[0, 1], points[1, 1]))
        return ((x - (left + right) / 2) / max(.5, (right - left) / 2)) ** 2 + \
               ((y - (top + bottom) / 2) / max(.5, (bottom - top) / 2)) ** 2 <= 1
    if len(points) > 512:
        points = points[np.linspace(0, len(points) - 1, 512).astype(int)]
    inside = np.zeros(shape, dtype=bool)
    previous = points[-1]
    for current in points:
        crossing = ((current[1] > y) != (previous[1] > y)) & \
                   (x < (previous[0] - current[0]) * (y - current[1]) /
                    (previous[1] - current[1] if previous[1] != current[1] else 1e-12) + current[0])
        inside ^= crossing
        previous = current
    return inside


class Session:
    def __init__(self):
        self.source = None
        self.cuts = {}

    @staticmethod
    def stack_range(d, req):
        start, end = int(req.get("start", 1)), int(req.get("end", d["frames"]))
        if not 1 <= start <= end <= d["frames"] or end - start + 1 > 256:
            raise ValueError("Expected an inclusive 1-based range of at most 256 slices")
        return start - 1, end

    @staticmethod
    def stack_limit(pixels):
        if pixels > 64_000_000:
            raise ValueError("Stack output exceeds 64 million pixels")

    @staticmethod
    def write_tiff(data, prefix, axes=None):
        import tifffile
        array = np.ascontiguousarray(data)
        descriptor, destination = tempfile.mkstemp(prefix=prefix, suffix=".tif")
        os.close(descriptor)
        try:
            tifffile.imwrite(destination, array, bigtiff=True,
                             photometric="rgb" if array.ndim >= 3 and array.shape[-1] in (3, 4) and
                             (axes == "TYXS" or (axes is None and array.ndim == 3)) else "minisblack",
                             metadata={"axes": axes} if axes else None)
        except Exception:
            os.unlink(destination)
            raise
        return destination

    def handle(self, req):
        op = req["op"]
        if op == "stack":
            action = req.get("action")
            op = {"imagesToStack": "imagesToStack", "stackToImages": "stackToImages",
                  "reslice": "reslice", "zAxisProfile": "zAxisProfile",
                  "measureStack": "measureStack", "statistics": "stackStatistics",
                  "stackStatistics": "stackStatistics"}.get(action, "stack")
        if op == "diagnostics":
            import importlib.metadata
            packages = ["numpy", "Pillow", "astropy", "tifffile", "zarr", "imagecodecs", "opencv-python-headless"]
            versions = {}
            for package in packages:
                try:
                    versions[package] = importlib.metadata.version(package)
                except importlib.metadata.PackageNotFoundError:
                    versions[package] = "MISSING"
            return dict(python=sys.executable, versions=versions)
        if op == "lutPreview":
            cmap = req.get("cmap", "gray")
            values = apply_lut(np.linspace(0, 1, 256), cmap)
            if values.ndim == 1:
                values = np.repeat(values[:, None], 3, axis=1)
            return {"cmap": cmap, "rgb": np.rint(np.clip(values, 0, 1) * 255).astype(np.uint8).tolist()}
        if op == "open":
            if self.source:
                self.source.close()
                self.source = None
            self.cuts.clear()
            self.source = Source(req["path"], int(req.get("maxPixels", 64_000_000)))
            return dict(path=self.source.path, kind=self.source.kind, datasets=self.source.datasets, warning=self.source.warning,
                        sliceLabels=self.source.slice_labels)
        if not self.source:
            raise ValueError("Open an image first")
        d = self.source.dataset(req.get("dataset", self.source.datasets[0]["id"]))
        frame = int(req.get("frame", 0))
        box = bounds(d, req.get("box"))
        if op == "render":
            return self.render(d, frame, box, req)
        if op == "duplicate":
            import tifffile
            selected = req.get("selection")
            if not req.get("ignoreSelection") and selected and selected.get("type") in ("roi", "oval", "polygon", "freehand"):
                box = bounds(d, req.get("box"))
            else:
                box = bounds(d)
            duplicate_stack = bool(req.get("duplicateStack")) and d["frames"] > 1
            first = max(1, min(d["frames"], int(req.get("first", 1))))
            last = max(first, min(d["frames"], int(req.get("last", d["frames"]))))
            planes = range(first-1, last) if duplicate_stack else (frame,)
            if (box[2]-box[0])*(box[3]-box[1]) > self.source.max_pixels:
                raise ValueError("Duplicate plane exceeds maxDecodedPixels; select a smaller area")
            descriptor, destination = tempfile.mkstemp(prefix="vivi-duplicate-", suffix=".tif")
            os.close(descriptor)
            try:
                with tifffile.TiffWriter(destination, bigtiff=True) as writer:
                    for plane in planes:
                        data = np.ascontiguousarray(self.source.read(d, plane, box))
                        writer.write(data, photometric="rgb" if data.ndim == 3 and data.shape[-1] in (3, 4) else "minisblack",
                                     contiguous=duplicate_stack, metadata={"axes": "YXS" if data.ndim == 3 else "YX"})
            except Exception:
                os.unlink(destination)
                raise
            return {"path": destination, "count": len(planes), "box": box}
        if op == "derive":
            import tifffile
            action = req.get("action")
            supported = {"crop", "flipHorizontal", "flipVertical", "add", "subtract", "multiply", "divide", "normalize", "equalizeHistogram", "zMax", "zMean", "zMin", "gaussian", "median", "unsharp", "smooth", "sharpen", "findEdges", "invertPixels", "sqrt", "square", "log", "exp", "abs", "thresholdBinary", "binaryErode", "binaryDilate", "binaryOpen", "binaryClose", "fftPower", "fftPowerImageJ", "channelRed", "channelGreen", "channelBlue", "to8", "to16", "to32", "toRgb", "resize", "rotateLeft", "rotateRight", "rotate180", "mean", "minimum", "maximum", "variance", "findMaxima", "noiseGaussian", "saltPepper", "shadowNorth", "shadowSouth", "shadowEast", "shadowWest", "binaryFillHoles", "binarySkeleton", "fftBandpass"}
            if action not in supported:
                raise ValueError("Unsupported image operation")
            area = (box[2]-box[0])*(box[3]-box[1])
            if area > self.source.max_pixels:
                raise ValueError("Image operation exceeds maxDecodedPixels; select a smaller area")
            if action.startswith("z"):
                if d["frames"] > 256:
                    raise ValueError("Projection supports at most 256 slices")
                result = None
                for plane in range(d["frames"]):
                    image = np.asarray(self.source.read(d, plane, box), dtype=np.float64)
                    if result is None:
                        result = image.copy()
                    elif action == "zMax":
                        result = np.fmax(result, image)
                    elif action == "zMin":
                        result = np.fmin(result, image)
                    else:
                        result += image
                if action == "zMean":
                    result /= d["frames"]
            else:
                result = np.asarray(self.source.read(d, frame, box))
                if action == "flipHorizontal":
                    result = result[:, ::-1]
                elif action == "flipVertical":
                    result = result[::-1]
                elif action in ("rotateLeft", "rotateRight", "rotate180"):
                    result = np.rot90(result, {"rotateLeft":1,"rotateRight":3,"rotate180":2}[action])
                elif action in ("channelRed", "channelGreen", "channelBlue"):
                    if result.ndim != 3 or result.shape[-1] < 3:
                        raise ValueError("Channel split requires an RGB image")
                    result = result[..., {"channelRed": 0, "channelGreen": 1, "channelBlue": 2}[action]]
                elif action == "resize":
                    import cv2
                    factor=finite_number(req.get("value"),1)
                    if not 0 < factor <= 32 or result.shape[0]*result.shape[1]*factor*factor > self.source.max_pixels:
                        raise ValueError("Scale factor or output size exceeds limit")
                    result=cv2.resize(np.ascontiguousarray(result), None, fx=factor, fy=factor, interpolation=cv2.INTER_LINEAR if factor >= 1 else cv2.INTER_AREA)
                elif action in ("to8", "to16", "to32", "toRgb"):
                    data=result.astype(np.float64)
                    if action == "toRgb":
                        if data.ndim == 2:
                            data=np.repeat(data[...,None],3,axis=-1)
                        action="to8"
                        rgb=True
                    else:
                        rgb=False
                        if data.ndim == 3:
                            data=np.mean(data[...,:3],axis=-1)
                    if action == "to32": result=data.astype(np.float32)
                    else:
                        low=finite_number(req.get("displayLow"),float(np.nanmin(data)))
                        high=finite_number(req.get("displayHigh"),float(np.nanmax(data)))
                        if high <= low: high=low+1
                        maximum=255 if action == "to8" else 65535
                        result=np.rint(np.clip((data-low)/(high-low),0,1)*maximum).astype(np.uint8 if action == "to8" else np.uint16)
                    if rgb: result=np.ascontiguousarray(result[...,:3])
                elif action in ("add", "subtract", "multiply", "divide"):
                    value = finite_number(req.get("value"), 0)
                    if action == "divide" and value == 0:
                        raise ValueError("Cannot divide by zero")
                    result = result.astype(np.float64)
                    result = {"add": lambda: result+value, "subtract": lambda: result-value,
                              "multiply": lambda: result*value, "divide": lambda: result/value}[action]()
                elif action == "normalize":
                    finite = result[np.isfinite(result)]
                    low, high = (float(finite.min()), float(finite.max())) if finite.size else (0., 1.)
                    result = np.clip((result.astype(np.float32)-low)/(high-low or 1.), 0, 1)
                elif action == "equalizeHistogram":
                    data = result.astype(np.float64)
                    channels = [data[..., index] for index in range(data.shape[-1])] if data.ndim == 3 else [data]
                    output = []
                    for channel in channels:
                        finite = channel[np.isfinite(channel)]
                        if finite.size < 2 or float(finite.min()) == float(finite.max()):
                            output.append(channel)
                            continue
                        low, high = float(finite.min()), float(finite.max())
                        counts, edges = np.histogram(finite, bins=256, range=(low, high))
                        cdf = np.cumsum(counts) / finite.size
                        equalized = np.interp(channel, edges[1:], low + cdf * (high - low))
                        output.append(np.where(np.isfinite(channel), equalized, channel))
                    result = (np.stack(output, axis=-1) if data.ndim == 3 else output[0]).astype(result.dtype)
                elif action in ("smooth", "sharpen", "findEdges", "binaryErode", "binaryDilate", "binaryOpen", "binaryClose", "mean", "minimum", "maximum", "variance", "findMaxima", "noiseGaussian", "saltPepper", "shadowNorth", "shadowSouth", "shadowEast", "shadowWest", "binaryFillHoles", "binarySkeleton", "fftBandpass"):
                    import cv2
                    data = np.ascontiguousarray(result.astype(np.float32))
                    if action == "smooth":
                        result = cv2.blur(data, (3, 3))
                    elif action == "sharpen":
                        result = cv2.filter2D(data, -1, np.array([[-1,-1,-1],[-1,12,-1],[-1,-1,-1]], dtype=np.float32)/4)
                    elif action == "findEdges":
                        result = cv2.magnitude(cv2.Sobel(data, cv2.CV_32F, 1, 0, ksize=3), cv2.Sobel(data, cv2.CV_32F, 0, 1, ksize=3))
                    elif action in ("mean", "minimum", "maximum", "variance"):
                        radius=int(finite_number(req.get("value"),1))
                        if not 1 <= radius <= 20: raise ValueError("Radius must be between 1 and 20 pixels")
                        kernel=(radius*2+1,radius*2+1)
                        if action == "mean": result=cv2.blur(data,kernel)
                        elif action == "minimum": result=cv2.erode(data,np.ones(kernel,dtype=np.uint8))
                        elif action == "maximum": result=cv2.dilate(data,np.ones(kernel,dtype=np.uint8))
                        else:
                            average=cv2.blur(data,kernel)
                            result=np.maximum(0,cv2.blur(data*data,kernel)-average*average)
                    elif action == "findMaxima":
                        tolerance=finite_number(req.get("value"),0)
                        if tolerance < 0: raise ValueError("Noise tolerance must be nonnegative")
                        gray=np.mean(data[...,:3],axis=-1) if data.ndim == 3 else data
                        peak=cv2.dilate(gray,np.ones((3,3),dtype=np.uint8))
                        result=np.uint8((gray>=peak)&(gray>=np.nanmin(gray)+tolerance))*255
                    elif action == "noiseGaussian":
                        sigma=finite_number(req.get("value"),25)
                        if not 0 <= sigma <= 1e6: raise ValueError("Noise standard deviation is out of range")
                        result=data+np.random.default_rng().normal(0,sigma,data.shape).astype(np.float32)
                    elif action == "saltPepper":
                        fraction=finite_number(req.get("value"),0.05)
                        if not 0 <= fraction <= 1: raise ValueError("Noise fraction must be between 0 and 1")
                        random=np.random.default_rng().random(data.shape[:2]);result=data.copy()
                        result[random<fraction/2]=np.nanmin(data)
                        result[random>1-fraction/2]=np.nanmax(data)
                    elif action.startswith("shadow"):
                        direction={"shadowNorth":(-1,0),"shadowSouth":(1,0),"shadowEast":(0,1),"shadowWest":(0,-1)}[action]
                        result=data-np.roll(data,direction,axis=(0,1))
                    elif action == "binaryFillHoles":
                        gray=np.mean(data[...,:3],axis=-1) if data.ndim==3 else data
                        binary=np.uint8(gray>0)
                        count,labels,stats,_=cv2.connectedComponentsWithStats(1-binary,8)
                        border=set(np.unique(np.concatenate((labels[0],labels[-1],labels[:,0],labels[:,-1]))))
                        result=np.uint8(binary|np.isin(labels,[i for i in range(1,count) if i not in border]))*255
                    elif action == "binarySkeleton":
                        gray=np.mean(data[...,:3],axis=-1) if data.ndim==3 else data
                        current=np.uint8(gray>0)*255;skeleton=np.zeros_like(current);kernel=cv2.getStructuringElement(cv2.MORPH_CROSS,(3,3))
                        for _ in range(min(max(current.shape),4096)):
                            eroded=cv2.erode(current,kernel)
                            skeleton=cv2.bitwise_or(skeleton,cv2.subtract(current,cv2.dilate(eroded,kernel)))
                            current=eroded
                            if not np.any(current):break
                        result=skeleton
                    elif action == "fftBandpass":
                        low=finite_number(req.get("value"),0.05)
                        if not 0 <= low <= 0.5: raise ValueError("Cutoff must be between 0 and 0.5")
                        gray=np.mean(data[...,:3],axis=-1) if data.ndim==3 else data
                        yy=np.fft.fftfreq(gray.shape[0])[:,None];xx=np.fft.fftfreq(gray.shape[1])[None,:]
                        mask=(yy*yy+xx*xx)>=low*low
                        result=np.real(np.fft.ifft2(np.fft.fft2(gray)*mask)).astype(np.float32)
                    else:
                        binary = np.uint8(np.any(data > 0, axis=-1) if data.ndim == 3 else data > 0) * 255
                        kernel = np.ones((3,3), dtype=np.uint8)
                        result = {"binaryErode":lambda:cv2.erode(binary,kernel),"binaryDilate":lambda:cv2.dilate(binary,kernel),"binaryOpen":lambda:cv2.morphologyEx(binary,cv2.MORPH_OPEN,kernel),"binaryClose":lambda:cv2.morphologyEx(binary,cv2.MORPH_CLOSE,kernel)}[action]()
                elif action in ("invertPixels", "sqrt", "square", "log", "exp", "abs", "thresholdBinary", "fftPower", "fftPowerImageJ"):
                    data = result.astype(np.float64)
                    if action == "invertPixels": result = np.nanmax(data) + np.nanmin(data) - data
                    elif action == "sqrt": result = np.sqrt(np.maximum(data, 0))
                    elif action == "square": result = np.square(data)
                    elif action == "log": result = np.log1p(np.maximum(data, 0))
                    elif action == "exp": result = np.exp(np.clip(data, -50, 50))
                    elif action == "abs": result = np.abs(data)
                    elif action == "thresholdBinary":
                        threshold = finite_number(req.get("value"), 0)
                        result = np.uint8(data >= threshold) * 255
                    elif action in ("fftPower", "fftPowerImageJ"):
                        if data.ndim == 3: data = np.mean(data[...,:3], axis=-1)
                        shape = data.shape
                        if action == "fftPowerImageJ":
                            shape = tuple(1 << (size - 1).bit_length() for size in shape)
                            if math.prod(shape) > self.source.max_pixels:
                                raise ValueError("Padded FFT exceeds maxDecodedPixels")
                        result = np.log1p(np.abs(np.fft.fftshift(np.fft.fft2(data, s=shape))))
                elif action in ("gaussian", "median", "unsharp"):
                    import cv2
                    radius = finite_number(req.get("value"), 1)
                    if not 0 < radius <= 20:
                        raise ValueError("Filter radius must be between 0 and 20 pixels")
                    if action == "median" and radius > 2:
                        raise ValueError("Median radius supports 1 or 2 pixels")
                    data = np.ascontiguousarray(result.astype(np.float32))
                    if action == "median":
                        kernel = 3 if radius <= 1 else 5
                        result = cv2.medianBlur(data, kernel)
                    else:
                        blurred = cv2.GaussianBlur(data, (0, 0), sigmaX=radius, sigmaY=radius)
                        result = blurred if action == "gaussian" else data + (data - blurred)
            descriptor, destination = tempfile.mkstemp(prefix="vivi-derived-", suffix=".tif")
            os.close(descriptor)
            try:
                result = np.ascontiguousarray(result)
                if req.get("preserveStack") and action in ("flipHorizontal", "flipVertical", "rotateLeft", "rotateRight", "rotate180") and d["frames"] > 1:
                    output_shape = list(d["shape"])
                    output_shape[d["y"]], output_shape[d["x"]] = result.shape[:2]
                    output_axes = d["axes"] or "Q" * len(d["extra"]) + "YX"
                    def transformed_planes():
                        for plane in range(d["frames"]):
                            if plane == frame:
                                yield result
                                continue
                            image = np.asarray(self.source.read(d, plane, box))
                            if action == "flipHorizontal": image = image[:, ::-1]
                            elif action == "flipVertical": image = image[::-1]
                            else: image = np.rot90(image, {"rotateLeft":1,"rotateRight":3,"rotate180":2}[action])
                            yield np.ascontiguousarray(image)
                    with tifffile.TiffWriter(destination, bigtiff=True) as writer:
                        writer.write(transformed_planes(), shape=tuple(output_shape), dtype=result.dtype,
                                     photometric="rgb" if result.ndim == 3 and result.shape[-1] in (3, 4) else "minisblack",
                                     metadata={"axes": output_axes})
                else:
                    tifffile.imwrite(destination, result, bigtiff=True,
                                     photometric="rgb" if result.ndim == 3 and result.shape[-1] in (3, 4) else "minisblack")
            except Exception:
                os.unlink(destination)
                raise
            return {"path": destination}
        if op == "mask":
            selected = req.get("selection") or {}
            if not selected or (box[2]-box[0])*(box[3]-box[1]) > min(self.source.max_pixels, 64_000_000):
                raise ValueError("Select an area within the configured pixel limit")
            if selected.get("type") in ("line", "angle"):
                image = Image.new("L", (box[2]-box[0], box[3]-box[1]), 0)
                points = [(float(x)-box[0], float(y)-box[1]) for x, y in selected["points"]]
                ImageDraw.Draw(image).line(points, fill=255, width=max(1, round(float(selected.get("strokeWidth", 1)))))
            else:
                shape = (box[3]-box[1], box[2]-box[0])
                image = Image.fromarray(selection_mask(selected, box, shape).astype(np.uint8)*255, mode="L")
            data = io.BytesIO()
            image.save(data, format="PNG")
            return {"png": base64.b64encode(data.getvalue()).decode("ascii"), "width": image.width, "height": image.height}
        if op == "montage":
            start, end = self.stack_range(d, req)
            columns = int(req.get("columns", 5))
            if not 1 <= columns <= 32:
                raise ValueError("Columns must be between 1 and 32")
            scale = finite_number(req.get("scalePercent"), 100)
            if not 1 <= scale <= 1000:
                raise ValueError("Scale percent must be between 1 and 1000")
            width = max(1, round(d["width"] * scale / 100))
            height = max(1, round(d["height"] * scale / 100))
            rows = math.ceil((end - start) / columns)
            self.stack_limit(columns * width * rows * height)
            first = np.asarray(self.source.read(d, start, bounds(d)))
            output = np.zeros((rows * height, columns * width) + first.shape[2:], dtype=first.dtype)
            for index, plane in enumerate(range(start, end)):
                image = first if plane == start else np.asarray(self.source.read(d, plane, bounds(d)))
                if scale != 100:
                    # Nearest neighbour keeps the source dtype and never creates display-scaled pixels.
                    yy = np.minimum(d["height"] - 1, np.floor(np.arange(height) * d["height"] / height).astype(int))
                    xx = np.minimum(d["width"] - 1, np.floor(np.arange(width) * d["width"] / width).astype(int))
                    image = image[np.ix_(yy, xx)]
                y, x = divmod(index, columns)
                output[y*height:(y+1)*height, x*width:(x+1)*width] = image
            path = self.write_tiff(output, "vivi-montage-")
            return {"path": path, "width": output.shape[1], "height": output.shape[0],
                    "slices": end - start, "scalePercent": scale}
        if op == "imagesToStack":
            paths = req.get("paths")
            if not isinstance(paths, list) or not paths or len(paths) > 256 or not all(isinstance(p, str) for p in paths):
                raise ValueError("Expected 1 to 256 image paths")
            images = []
            for path in paths:
                source = Source(path, self.source.max_pixels)
                try:
                    item = source.datasets[0]
                    if item["frames"] != 1:
                        raise ValueError("Each input image must contain one plane")
                    self.stack_limit(item["width"] * item["height"] * len(paths))
                    image = np.array(source.read(item, 0, bounds(item)), copy=True)
                    if images and (image.shape != images[0].shape or image.dtype != images[0].dtype):
                        raise ValueError("Images must have matching shape and dtype")
                    images.append(image)
                finally:
                    source.close()
            data = np.stack(images)
            return {"path": self.write_tiff(data, "vivi-stack-", axes="TYXS" if data.ndim == 4 else "TYX"),
                    "frames": len(images), "width": data.shape[2], "height": data.shape[1]}
        if op == "stackToImages":
            start, end = self.stack_range(d, req)
            self.stack_limit(d["width"] * d["height"])
            paths = []
            try:
                for plane in range(start, end):
                    paths.append(self.write_tiff(self.source.read(d, plane, bounds(d)), "vivi-slice-"))
            except Exception:
                for path in paths:
                    os.unlink(path)
                raise
            return {"paths": paths, "frames": list(range(start + 1, end + 1))}
        if op == "reslice":
            start, end = self.stack_range(d, req)
            axis = req.get("axis", "y")
            if axis not in ("x", "y"):
                raise ValueError("Reslice axis must be x or y")
            position = int(req.get("position", 0))
            limit = d["width"] if axis == "x" else d["height"]
            if not 0 <= position < limit:
                raise ValueError("Reslice position out of bounds")
            length = d["height"] if axis == "x" else d["width"]
            self.stack_limit(length * (end - start))
            line_box = [position, 0, position + 1, d["height"]] if axis == "x" else [0, position, d["width"], position + 1]
            lines = [np.asarray(self.source.read(d, plane, line_box))[0 if axis == "y" else slice(None),
                                                                    slice(None) if axis == "y" else 0]
                     for plane in range(start, end)]
            data = np.stack(lines)
            return {"path": self.write_tiff(data, "vivi-reslice-"), "width": length,
                    "height": end - start, "axis": axis, "position": position}
        if op == "zAxisProfile":
            start, end = self.stack_range(d, req)
            x, y = int(req["x"]), int(req["y"])
            if not (0 <= x < d["width"] and 0 <= y < d["height"]):
                raise ValueError("Pixel out of bounds")
            values = [np.asarray(self.source.read(d, plane, [x, y, x+1, y+1])[0, 0], dtype=float)
                      for plane in range(start, end)]
            return {"frames": list(range(start + 1, end + 1)),
                    "values": [np.where(np.isfinite(v), v, None).tolist() for v in values],
                    "x": x, "y": y, "dataset": d["id"]}
        if op == "measureStack":
            start, end = self.stack_range(d, req)
            return {"results": [self.measure(d, plane, box, req.get("selection")) for plane in range(start, end)],
                    "dataset": d["id"], "box": box}
        if op == "stackStatistics":
            start, end = self.stack_range(d, req)
            results = [self.measure(d, plane, box, req.get("selection")) for plane in range(start, end)]
            count = sum(item["count"] for item in results)
            total = sum(item["sum"] for item in results)
            mean = total / count if count else None
            variance = sum(item["count"] * (item["std"] ** 2 + (item["mean"] - mean) ** 2)
                           for item in results if item["count"]) / count if count else None
            return {"dataset": d["id"], "box": box, "frames": end - start,
                    "count": count, "area": sum(item["area"] for item in results),
                    "mean": mean, "std": math.sqrt(max(0, variance)) if count else None,
                    "min": min((item["min"] for item in results if item["count"]), default=None),
                    "max": max((item["max"] for item in results if item["count"]), default=None), "sum": total}
        if op == "pixel":
            x, y = int(req["x"]), int(req["y"])
            if not (0 <= x < d["width"] and 0 <= y < d["height"]):
                raise ValueError("Pixel out of bounds")
            v = np.asarray(self.source.read(d, frame, [x, y, x + 1, y + 1])[0, 0], dtype=float)
            return dict(x=x, y=y, value=np.where(np.isfinite(v), v, None).tolist())
        if op == "measure":
            return self.measure(d, frame, box, req.get("selection"))
        if op == "histogram":
            step = max(1, math.ceil(math.sqrt((box[2]-box[0]) * (box[3]-box[1]) / 262144)))
            image = scalar(self.source.read(d, frame, box, step))
            a = image[selection_mask(req.get("selection"), box, image.shape, step)].ravel()
            a = a[np.isfinite(a)]
            bins = int(req.get("bins", 256))
            if not 1 <= bins <= 4096:
                raise ValueError("Histogram bins must be between 1 and 4096")
            minimum = float(a.min()) if a.size else None
            maximum = float(a.max()) if a.size else None
            low = finite_number(req.get("xMin"), minimum if minimum is not None else 0)
            high = finite_number(req.get("xMax"), maximum if maximum is not None else 1)
            if high <= low:
                if "xMin" in req or "xMax" in req:
                    raise ValueError("Histogram xMax must exceed xMin")
                high = low + 1
            counts, edges = np.histogram(a, bins=bins, range=(low, high))
            mode_index = int(np.argmax(counts)) if a.size else None
            return dict(counts=counts.tolist(), edges=edges.tolist(), sampled=step > 1, step=step,
                        samples=int(a.size), dataset=d["id"], frame=frame, box=box,
                        min=minimum, max=maximum, mean=float(a.mean()) if a.size else None,
                        std=float(a.std()) if a.size else None,
                        mode=float((edges[mode_index] + edges[mode_index+1]) / 2) if mode_index is not None else None,
                        modeCount=int(counts[mode_index]) if mode_index is not None else 0,
                        binWidth=float(edges[1] - edges[0]))
        if op == "profile":
            selected = req.get("selection") or {}
            path = selected.get("points") if selected.get("type") == "line" else None
            if not path:
                points = req["points"]
                if len(points) != 4:
                    raise ValueError("Expected line endpoints")
                path = [points[:2], points[2:]]
            path = np.asarray(path, dtype=float)
            if path.ndim != 2 or path.shape[1] != 2 or len(path) < 2 or not np.isfinite(path).all():
                raise ValueError("Expected finite line coordinates")
            if not all(0 <= x < d["width"] and 0 <= y < d["height"] for x, y in path):
                raise ValueError("Line endpoints out of bounds")
            segments = np.linalg.norm(np.diff(path, axis=0), axis=1)
            cumulative = np.r_[0, np.cumsum(segments)]
            length = float(cumulative[-1])
            n = min(2048, max(2, int(length) + 1))
            distances = np.linspace(0, length, n)
            segment_ids = np.clip(np.searchsorted(cumulative[1:], distances, side="right"), 0, len(segments)-1)
            fraction = (distances - cumulative[segment_ids]) / np.maximum(segments[segment_ids], 1e-12)
            samples = path[segment_ids] + fraction[:, None] * (path[segment_ids+1] - path[segment_ids])
            xs, ys = samples[:, 0].astype(int), samples[:, 1].astype(int)
            # Group nearby points into bounded tiles, avoiding one decoder call per pixel.
            values = np.empty(n)
            groups = {}
            for i, (x, y) in enumerate(zip(xs, ys)):
                groups.setdefault((int(x)//256, int(y)//256), []).append(i)
            for (tx, ty), ids in groups.items():
                a = scalar(self.source.read(d, frame, [tx*256, ty*256, min((tx+1)*256,d["width"]), min((ty+1)*256,d["height"])]))
                values[ids] = a[ys[ids]-ty*256, xs[ids]-tx*256]
            return dict(distance=distances.tolist(), values=np.where(np.isfinite(values), values, None).tolist(), dataset=d["id"], frame=frame, points=path.ravel().tolist())
        raise ValueError(f"Unknown operation: {op}")

    def render(self, d, frame, box, req):
        limit = max(64, min(2048, int(req.get("size", 1600))))
        step = max(1, math.ceil(max(box[2]-box[0], box[3]-box[1]) / limit))
        raw = self.source.read(d, frame, box, step, pyramid=True)
        data = np.asarray(raw, dtype=np.float64)
        mode = req.get("cuts", "percentile")
        key = (d["id"], frame, mode)
        if mode == "manual":
            low, high = finite_number(req.get("low"), 0), finite_number(req.get("high"), 1)
            if high <= low:
                raise ValueError("Maximum must be greater than minimum")
        elif key in self.cuts:
            low, high = self.cuts[key]
        else:
            sample_step = max(1, math.ceil(max(d["width"],d["height"]) / 512))
            sample_raw = self.source.read(d, frame, bounds(d), sample_step, pyramid=True)
            sample = np.asarray(sample_raw, dtype=np.float64)
            if sample.ndim == 3:
                sample = sample[..., :3]
            sample = sample[np.isfinite(sample)]
            if sample_raw.ndim == 3 and sample_raw.dtype == np.uint8 and mode == "percentile":
                low, high = 0., 255.
            elif not sample.size:
                low, high = 0., 1.
            elif mode == "zscale":
                from astropy.visualization import ZScaleInterval
                low, high = map(float, ZScaleInterval().get_limits(sample))
            elif mode == "minmax":
                low, high = float(sample.min()), float(sample.max())
            elif mode in ("p90", "p95", "p99", "p999"):
                coverage = {"p90": 90, "p95": 95, "p99": 99, "p999": 99.9}[mode]
                low, high = map(float, np.percentile(sample, [(100 - coverage) / 2, (100 + coverage) / 2]))
            else:
                low, high = map(float, np.percentile(sample, [0.5, 99.5]))
            if high <= low:
                high = low + 1
            if len(self.cuts) > 128:
                self.cuts.clear()
            self.cuts[key] = low, high
        finite = np.isfinite(data)
        if req.get('raw'):
            preview = np.ascontiguousarray(raw.astype(np.float32, copy=False))
            if np.isfinite(data).any() and np.nanmax(np.abs(data[np.isfinite(data)])) > np.finfo(np.float32).max:
                preview = np.ascontiguousarray(data)
            return dict(raw=base64.b64encode(preview.tobytes()).decode('ascii'),
                        dtype=str(preview.dtype), channels=preview.shape[-1] if preview.ndim == 3 else 1,
                        box=box, width=preview.shape[1], height=preview.shape[0],
                        low=low, high=high, step=step)
        scaled = np.clip((np.nan_to_num(data, nan=low, posinf=high, neginf=low)-low)/(high-low), 0, 1)
        stretch = req.get("stretch", "linear")
        if stretch == "log":
            scaled = np.log1p(1000 * scaled) / np.log1p(1000)
        elif stretch == "sqrt":
            scaled = np.sqrt(scaled)
        elif stretch == "asinh":
            scaled = np.arcsinh(10 * scaled) / np.arcsinh(10)
        elif stretch == "power":
            scaled = np.power(scaled, 0.5)
        elif stretch == "squared":
            scaled = np.square(scaled)
        elif stretch == "sinh":
            scaled = np.sinh(3 * scaled) / np.sinh(3)
        elif stretch == "histeq":
            bins = np.histogram(np.asarray(scaled[np.isfinite(scaled)]), bins=256, range=(0, 1))[0]
            cdf = bins.cumsum()
            if cdf[-1]:
                scaled = np.interp(scaled, np.linspace(0, 1, 256), cdf / cdf[-1])
        if req.get("invert"):
            scaled = 1 - scaled
        if req.get("threshold"):
            lower = finite_number(req.get("thresholdLow"), low)
            upper = finite_number(req.get("thresholdHigh"), high)
            a = scalar(data)
            scaled = ((a >= lower) & (a <= upper) & np.isfinite(a)).astype(float)
        cmap = req.get("cmap", "gray")
        if scaled.ndim == 3:
            scaled = scaled[..., :3]
        else:
            scaled = apply_lut(scaled, cmap)
        scaled[~(finite.all(axis=-1) if finite.ndim == 3 else finite)] = 0
        image = Image.fromarray(np.uint8(np.clip(scaled,0,1)*255))
        image.thumbnail((limit, limit), Image.Resampling.NEAREST)
        output = io.BytesIO()
        image.save(output, format="PNG")
        return dict(png=base64.b64encode(output.getvalue()).decode("ascii"), box=box,
                    width=image.width, height=image.height, low=low, high=high, step=step)

    def measure(self, d, frame, box, selection=None):
        # Stable batch-combined moments; never materialize the full ROI.
        n, mean, m2, total, selected_area = 0, 0., 0., 0., 0
        minimum, maximum = math.inf, -math.inf
        for y in range(box[1], box[3], 256):
            for x in range(box[0], box[2], 1024):
                tile = [x, y, min(x+1024,box[2]), min(y+256,box[3])]
                image = scalar(self.source.read(d, frame, tile))
                mask = selection_mask(selection, tile, image.shape)
                selected_area += int(mask.sum())
                a = image[mask].ravel()
                a = a[np.isfinite(a)]
                k = int(a.size)
                if not k:
                    continue
                amean = float(a.mean())
                delta = amean - mean
                m2 += float(np.square(a-amean).sum()) + delta*delta*n*k/(n+k)
                mean += delta*k/(n+k)
                n += k
                total += float(a.sum())
                minimum, maximum = min(minimum,float(a.min())), max(maximum,float(a.max()))
        return dict(box=box, area=selected_area, count=n,
                    mean=mean if n else None, std=math.sqrt(max(0,m2/n)) if n else None,
                    min=minimum if n else None, max=maximum if n else None, sum=total,
                    dataset=d["id"], frame=frame, units="pixels", colorPolicy="mean(R,G,B)")


def main():
    session = Session()
    try:
        for line in sys.stdin:
            req = {}
            try:
                req = json.loads(line)
                with warnings.catch_warnings():
                    warnings.simplefilter("default")
                    result = session.handle(req)
                response = dict(id=req.get("id"), result=result)
                encoded = json.dumps(response, allow_nan=False, separators=(",", ":"))
            except Exception as exc:
                encoded = json.dumps(dict(id=req.get("id"), error=f"{type(exc).__name__}: {exc}"))
            print(encoded, flush=True)
    finally:
        if session.source:
            session.source.close()


if __name__ == "__main__":
    main()
