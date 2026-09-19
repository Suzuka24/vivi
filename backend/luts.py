"""Small built-in lookup tables for scientific grayscale previews."""
import numpy as np

PALETTES = {
    "fire": [(0, 0, 0), (90, 0, 0), (220, 45, 0), (255, 180, 0), (255, 255, 255)],
    "ice": [(0, 0, 0), (0, 40, 110), (0, 160, 210), (185, 235, 255), (255, 255, 255)],
    "spectrum": [(0, 0, 0), (120, 0, 180), (0, 50, 255), (0, 210, 170), (255, 240, 0), (255, 0, 0)],
    "redgreen": [(0, 0, 0), (220, 0, 0), (255, 240, 0), (0, 255, 0)],
    "heat": [(0, 0, 0), (255, 0, 0), (255, 255, 0), (255, 255, 255)],
    "cool": [(0, 255, 255), (255, 0, 255)],
    "sepia": [(0, 0, 0), (92, 52, 30), (190, 151, 105), (255, 242, 205)],
    "viridis": [(68, 1, 84), (59, 82, 139), (33, 145, 140), (94, 201, 98), (253, 231, 37)],
    "plasma": [(13, 8, 135), (126, 3, 168), (204, 71, 120), (248, 149, 64), (240, 249, 33)],
    "magma": [(0, 0, 4), (82, 18, 123), (182, 55, 121), (251, 140, 60), (252, 253, 191)],
    "inferno": [(0, 0, 4), (87, 16, 110), (187, 55, 84), (249, 142, 9), (252, 255, 164)],
    "turbo": [(48, 18, 59), (56, 105, 244), (39, 205, 196), (157, 253, 72), (249, 179, 34), (180, 4, 38)],
}


def apply_lut(scaled, name):
    """Map normalized luminance to RGB; preserve 2-D gray for the gray LUT."""
    if name == "gray":
        return scaled
    if name == "rgb332":
        values = np.asarray(np.clip(scaled, 0, 1) * 255, dtype=np.uint8)
        return np.stack([(values >> 5) / 7, ((values >> 2) & 7) / 7, (values & 3) / 3], axis=-1)
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
