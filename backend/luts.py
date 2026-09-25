"""Small built-in lookup tables for scientific grayscale previews."""
import numpy as np
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def imagej_tables():
    with np.load(Path(__file__).with_name("imagej_luts.npz"), allow_pickle=False) as archive:
        tables = {name: archive[name] for name in archive.files}
    aliases = {
        "ij-001-mpl-plasma": "ij-mpl-plasma",
        "ij-002-physics": "ij-physics",
        "ij-003-phase": "ij-phase",
        "ij-004-spectrum": "ij-002-spectrum",
        "ij-005-ice": "ij-003-ice",
        "ij-006-phase": "ij-004-phase",
        "ij-007-random": "ij-005-random",
    }
    tables.update({alias: tables[source] for alias, source in aliases.items()})
    return tables

PALETTES = {
    "heat": [(0, 0, 0), (255, 0, 0), (255, 255, 0), (255, 255, 255)],
    "plasma": [(13, 8, 135), (126, 3, 168), (204, 71, 120), (248, 149, 64), (240, 249, 33)],
    "magma": [(0, 0, 4), (82, 18, 123), (182, 55, 121), (251, 140, 60), (252, 253, 191)],
    "inferno": [(0, 0, 4), (87, 16, 110), (187, 55, 84), (249, 142, 9), (252, 255, 164)],
    "turbo": [(48, 18, 59), (56, 105, 244), (39, 205, 196), (157, 253, 72), (249, 179, 34), (180, 4, 38)],
}


def _interpolated_table(points):
    """Match ImageJ LutLoader.interpolate(), including its truncation behavior."""
    points = np.asarray(points, dtype=np.float64)
    scale = len(points) / 256.0
    positions = np.arange(256) * scale
    lower = positions.astype(int)
    upper = np.minimum(lower + 1, len(points) - 1)
    fraction = positions - lower
    return ((1-fraction[:, None])*points[lower] + fraction[:, None]*points[upper]).astype(np.uint8)


@lru_cache(maxsize=1)
def imagej_builtin_tables():
    fire = _interpolated_table(list(zip(
        [0,0,1,25,49,73,98,122,146,162,173,184,195,207,217,229,240,252,255,255,255,255,255,255,255,255,255,255,255,255,255,255],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,14,35,57,79,101,117,133,147,161,175,190,205,219,234,248,255,255,255,255],
        [0,61,96,130,165,192,220,227,210,181,151,122,93,64,35,5,0,0,0,0,0,0,0,0,0,0,0,35,98,160,223,255])))
    ice = _interpolated_table(list(zip(
        [0,0,0,0,0,0,19,29,50,48,79,112,134,158,186,201,217,229,242,250,250,250,250,251,250,250,250,250,251,251,243,230],
        [156,165,176,184,190,196,193,184,171,162,146,125,107,93,81,87,92,97,95,93,93,90,85,69,64,54,47,35,19,0,4,0],
        [140,147,158,166,170,176,209,220,234,225,236,246,250,251,250,250,245,230,230,222,202,180,163,142,123,114,106,94,84,64,26,27])))
    hue = np.arange(256, dtype=np.float64) / 255
    sector = np.floor(hue*6).astype(int)
    fraction = hue*6-sector
    q = np.rint((1-fraction)*255).astype(np.uint8)
    t = np.rint(fraction*255).astype(np.uint8)
    full = np.full(256, 255, dtype=np.uint8)
    zero = np.zeros(256, dtype=np.uint8)
    choices = ((full,t,zero),(q,full,zero),(zero,full,t),(zero,q,full),(t,zero,full),(full,zero,q))
    spectrum = np.asarray([choices[sector[i] % 6][channel][i] for i in range(256) for channel in range(3)], dtype=np.uint8).reshape(256,3)
    values = np.arange(256, dtype=np.uint8)
    rgb332 = np.stack([values & 0xe0, (values << 3) & 0xe0, (values << 6) & 0xc0], axis=1)
    redgreen = np.zeros((256,3), dtype=np.uint8)
    redgreen[:128,0] = np.arange(128, dtype=np.uint8)*2
    redgreen[128:,1] = np.arange(128,256, dtype=np.uint8)*2
    return {"fire":fire,"ice":ice,"spectrum":spectrum,"rgb332":rgb332,"redgreen":redgreen}


def apply_lut(scaled, name):
    """Map normalized luminance to RGB; preserve 2-D gray for the gray LUT."""
    if name == "gray":
        return scaled
    name = {"cool":"ij-cool", "sepia":"ij-sepia", "viridis":"ij-viridis"}.get(name, name)
    if name.startswith("ij-"):
        table = imagej_tables().get(name)
        if table is None:
            raise ValueError(f"Unknown LUT: {name}")
        return table[np.clip(np.rint(np.asarray(scaled)*255), 0, 255).astype(np.uint8)] / 255
    if name in imagej_builtin_tables():
        table = imagej_builtin_tables()[name]
        return table[np.clip(np.rint(np.asarray(scaled)*255), 0, 255).astype(np.uint8)] / 255
    single = {"red": 0, "green": 1, "blue": 2, "cyan": 0, "magenta": 1, "yellow": 2}
    if name in single:
        channels = [scaled, scaled, scaled]
        channels[single[name]] = np.zeros_like(scaled) if name in ("cyan", "magenta", "yellow") else scaled
        if name in ("red", "green", "blue"):
            channels = [scaled if i == single[name] else np.zeros_like(scaled) for i in range(3)]
        return np.stack(channels, axis=-1)
    points = PALETTES.get(name)
    if points is None:
        raise ValueError(f"Unknown LUT: {name}")
    stops = np.linspace(0, 1, len(points))
    return np.stack([np.interp(scaled, stops, [rgb[channel] / 255 for rgb in points]) for channel in range(3)], axis=-1)
