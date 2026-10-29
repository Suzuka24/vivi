"""DS9-compatible ZScale limits.

This is an independent implementation of the algorithm used by SAOImage DS9.
DS9's menu defaults are contrast=0.25, sample=600, and line=120.
"""

import math

import numpy as np


def _sample_image(image, sample_size=600, pixels_per_line=120):
    data = np.asarray(image)
    if data.ndim == 3:
        data = np.mean(data[..., : min(3, data.shape[-1])], axis=-1)
    if data.ndim != 2:
        data = np.reshape(data, (1, -1))
    height, width = data.shape
    wanted_per_line = max(1, min(width, int(pixels_per_line)))
    column_step = max(2, (width + wanted_per_line - 1) // wanted_per_line)
    actual_per_line = max(1, (width + column_step - 1) // column_step)
    minimum_lines = max(1, int(sample_size) // int(pixels_per_line))
    wanted_lines = max(
        minimum_lines,
        min(height, (int(sample_size) + actual_per_line - 1) // actual_per_line),
    )
    line_step = max(2, height // wanted_lines)
    rows = []
    for line in range((line_step + 1) // 2, height + 1, line_step):
        row = np.asarray(data[line - 1, 0:width:column_step], dtype=np.float32)
        rows.append(row[np.isfinite(row)])
    if rows:
        sample = np.concatenate(rows)
        if sample.size:
            return sample
    return np.asarray(data[np.isfinite(data)], dtype=np.float32)


def _fit_line(sample, rejection_sigma=2.5, grow=1, iterations=5):
    count = len(sample)
    if count <= 1:
        return count, float(sample[0]) if count else 0.0, 0.0
    xscale = 2.0 / (count - 1)
    x = np.arange(count, dtype=np.float64) * xscale - 1.0
    bad = np.zeros(count, dtype=np.int8)  # 0=good, 1=bad, 2=pending rejection
    sum_x2 = float(np.dot(x, x))
    sum_xz = float(np.dot(sample.astype(np.float64), x))
    sum_x = 0.0
    sum_z = float(np.sum(sample, dtype=np.float64))
    intercept = sum_z / count
    slope = sum_xz / sum_x2
    good_count = count
    minimum = max(5, int(count * 0.5))

    for _ in range(iterations):
        previous = good_count
        residual = sample - (x * slope + intercept)
        accepted = residual[bad == 0]
        if accepted.size < 2:
            sigma = 0.0
        else:
            sigma = float(np.std(accepted, ddof=1))
        threshold = sigma * rejection_sigma
        good_count = count
        for index in range(count):
            if bad[index] == 1:
                good_count -= 1
                continue
            if residual[index] < -threshold or residual[index] > threshold:
                start = max(0, index - grow)
                stop = min(count, index + grow)
                for neighbor in range(start, stop):
                    if bad[neighbor] == 1:
                        continue
                    if neighbor <= index:
                        xv = x[neighbor]
                        zv = float(sample[neighbor])
                        sum_x2 -= xv * xv
                        sum_xz -= zv * xv
                        sum_x -= xv
                        sum_z -= zv
                        bad[neighbor] = 1
                        good_count -= 1
                    else:
                        bad[neighbor] = 2
        if good_count > 0 and sum_x2:
            row_ratio = sum_x / sum_x2
            denominator = good_count - row_ratio * sum_x
            if denominator:
                intercept = (sum_z - row_ratio * sum_xz) / denominator
                slope = (sum_xz - intercept * sum_x) / sum_x2
        if good_count >= previous or good_count < minimum:
            break
    return good_count, intercept - slope, slope * xscale


def ds9_zscale(image, contrast=0.25, sample_size=600, pixels_per_line=120):
    """Return the lower and upper limits produced by DS9's ZScale defaults."""
    sample = _sample_image(image, sample_size, pixels_per_line)
    if sample.size == 0:
        return 0.0, 1.0
    sample.sort()
    count = len(sample)
    minimum = float(sample[0])
    maximum = float(sample[-1])
    if count == 1 or maximum <= minimum:
        return minimum, maximum
    center = max(1, (count + 1) // 2)
    left = center - 1
    median = float(sample[left]) if count % 2 or center >= count else float((sample[left] + sample[left + 1]) / 2)
    grow = max(1, int(math.floor(count * 0.01 + 0.5)))
    good, _, fitted_slope = _fit_line(sample, grow=grow)
    if good < max(5, int(count * 0.5)):
        return minimum, maximum
    if contrast > 0:
        fitted_slope /= contrast
    low = max(minimum, median - (center - 1) * fitted_slope)
    high = min(maximum, median + (count - center) * fitted_slope)
    return (float(low), float(high)) if high > low else (minimum, maximum)
