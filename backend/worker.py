"""One read-only image session per process. JSON lines over stdio; no HTTP server."""
import base64
import io
import json
import math
import os
import sys
import warnings

import numpy as np
from PIL import Image
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
        self.warning = ""
        try:
            self._open()
        except Exception:
            self.close()
            raise

    def _open(self):
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

    def read(self, d, frame, box, step=1, pyramid=False):
        frame = int(frame)
        if not 0 <= frame < d["frames"]:
            raise ValueError("Frame out of range")
        x0, y0, x1, y1 = box
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
        if selection.get("variant") != "rounded":
            return np.ones(shape, dtype=bool)
        left, right = sorted((points[0, 0], points[1, 0]))
        top, bottom = sorted((points[0, 1], points[1, 1]))
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

    def handle(self, req):
        op = req["op"]
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
        if op == "open":
            if self.source:
                self.source.close()
                self.source = None
            self.cuts.clear()
            self.source = Source(req["path"], int(req.get("maxPixels", 64_000_000)))
            return dict(path=self.source.path, kind=self.source.kind, datasets=self.source.datasets, warning=self.source.warning)
        if not self.source:
            raise ValueError("Open an image first")
        d = self.source.dataset(req.get("dataset", self.source.datasets[0]["id"]))
        frame = int(req.get("frame", 0))
        box = bounds(d, req.get("box"))
        if op == "render":
            return self.render(d, frame, box, req)
        if op == "montage":
            start = max(0, min(d["frames"] - 1, int(req.get("start", 1)) - 1))
            end = max(start + 1, min(d["frames"], int(req.get("end", d["frames"]))))
            if end - start > 256:
                raise ValueError("Montage supports at most 256 slices per operation")
            columns = max(1, min(32, int(req.get("columns", 5))))
            tile = max(32, min(512, int(req.get("tile", 160))))
            rows = math.ceil((end - start) / columns)
            if columns * rows * tile * tile > 64_000_000:
                raise ValueError("Montage output exceeds 64 million pixels")
            output = Image.new("RGB", (columns * tile, rows * tile), "black")
            for index, plane in enumerate(range(start, end)):
                result = self.render(d, plane, bounds(d), {**req, "size": tile})
                with Image.open(io.BytesIO(base64.b64decode(result["png"]))) as image:
                    picture = image.convert("RGB")
                    factor = min(tile / picture.width, tile / picture.height)
                    picture = picture.resize((max(1, round(picture.width * factor)),
                                              max(1, round(picture.height * factor))), Image.Resampling.NEAREST)
                    output.paste(picture, ((index % columns) * tile + (tile - picture.width) // 2,
                                           (index // columns) * tile + (tile - picture.height) // 2))
            data = io.BytesIO()
            output.save(data, format="PNG")
            return {"png": base64.b64encode(data.getvalue()).decode("ascii"),
                    "width": output.width, "height": output.height, "slices": end - start}
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
            counts, edges = np.histogram(a, bins=128)
            return dict(counts=counts.tolist(), edges=edges.tolist(), sampled=step > 1, step=step, samples=int(a.size), dataset=d["id"], frame=frame, box=box)
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
