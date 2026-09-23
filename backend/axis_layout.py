"""Axis naming and rearrangement rules for opening multidimensional images."""
import math
import re

def _extra_labels(count):
    if count == 1:
        return ["z"]
    if count == 2:
        return ["u", "v"]
    pool = []
    for letter in "tzuvqrsabcdefghijklmnopxy":
        if letter not in "hwc" and letter not in pool:
            pool.append(letter)
    if count > len(pool):
        raise ValueError("Too many dimensions to assign single-letter axis names")
    return pool[:count]


def _unravel(index, shape):
    values = [0] * len(shape)
    for position in range(len(shape) - 1, -1, -1):
        values[position] = index % shape[position]
        index //= shape[position]
    return tuple(values)


def infer_layout(shape, axes=""):
    """Return a stable logical axis order while retaining storage-axis indexes."""
    shape = tuple(int(value) for value in shape)
    if len(shape) < 2 or any(value < 1 for value in shape):
        raise ValueError("Image data must have at least two non-empty dimensions")
    axes = axes.upper() if len(axes) == len(shape) else ""
    channel = next((index for index, name in enumerate(axes)
                    if name in ("S", "C") and shape[index] in (3, 4)), None)
    if axes and "Y" in axes and "X" in axes:
        y, x = axes.index("Y"), axes.index("X")
        if channel is None and len(shape) == 3 and shape[0] == 3 and axes[0] not in ("Z", "T"):
            channel = 0
    elif len(shape) == 3 and shape[0] == 3:
        channel, y, x = 0, 1, 2
    elif len(shape) >= 3 and shape[-1] in (3, 4):
        channel, y, x = len(shape) - 1, len(shape) - 3, len(shape) - 2
    else:
        y, x = len(shape) - 2, len(shape) - 1
    extras = [index for index in range(len(shape)) if index not in (y, x, channel)]
    labels = _extra_labels(len(extras))
    ordered = list(zip(labels, extras)) + [("h", y), ("w", x)]
    if channel is not None:
        ordered.append(("c", channel))
    return {
        "sourceShape": [shape[index] for _, index in ordered],
        "sourceAxes": [label for label, _ in ordered],
        "labelToStorage": {label: index for label, index in ordered},
        "storageShape": shape,
    }


def parse_target(layout, expression=None):
    labels = layout["sourceAxes"]
    if expression is None:
        # A viewer stack has one slice dimension. Fold every non-spatial,
        # non-channel axis into it, while leaving RGB(A) channels last.
        extras = [label for label in labels if label not in ("h", "w", "c")]
        groups = (["".join(extras)] if extras else []) + ["h", "w"]
        if "c" in labels:
            groups.append("c")
        expression = " ".join(groups)
    else:
        expression = str(expression).strip().lower()
    groups = [group for group in re.split(r"[\s,]+", expression) if group]
    if not groups or any(not re.fullmatch(r"[a-z]+", group) for group in groups):
        raise ValueError("Target shape must contain axis letters separated by spaces")
    flattened = list("".join(groups))
    if len(flattened) != len(set(flattened)) or sorted(flattened) != sorted(labels):
        raise ValueError("Target shape must use every source axis exactly once")
    if "h" not in groups or "w" not in groups:
        raise ValueError("h and w must remain separate target dimensions")
    h, w = groups.index("h"), groups.index("w")
    channel = groups.index("c") if "c" in groups and groups[-1] == "c" else None
    expected_end = len(groups) - (1 if channel is not None else 0)
    if (h, w) != (expected_end - 2, expected_end - 1):
        raise ValueError("Target shape must end with h w, optionally followed by c")
    label_sizes = {label: layout["storageShape"][storage]
                   for label, storage in layout["labelToStorage"].items()}
    target_shape = [math.prod(label_sizes[label] for label in group) for group in groups]
    extra = [index for index in range(len(groups)) if index not in (h, w, channel)]
    return {
        **layout,
        "targetExpression": " ".join(groups),
        "targetGroups": [list(group) for group in groups],
        "shape": tuple(target_shape),
        "targetAxes": "".join(groups),
        "width": target_shape[w],
        "height": target_shape[h],
        "frames": math.prod(target_shape[index] for index in extra),
        "y": h,
        "x": w,
        "channel": channel,
        "extra": extra,
    }


def make_layout(shape, axes="", target=None):
    return parse_target(infer_layout(shape, axes), target)


def storage_indices(layout, frame, y_slice, x_slice):
    """Map a flattened target frame and XY slices back to storage order."""
    storage_shape = layout["storageShape"]
    indices = [slice(None)] * len(storage_shape)
    frame_shape = tuple(layout["shape"][index] for index in layout["extra"])
    coordinates = iter(() if not frame_shape else _unravel(frame, frame_shape))
    for group_index in layout["extra"]:
        coordinate = int(next(coordinates))
        group = layout["targetGroups"][group_index]
        sizes = tuple(storage_shape[layout["labelToStorage"][label]] for label in group)
        values = (coordinate,) if len(group) == 1 else _unravel(coordinate, sizes)
        for label, value in zip(group, values):
            indices[layout["labelToStorage"][label]] = int(value)
    indices[layout["labelToStorage"]["h"]] = y_slice
    indices[layout["labelToStorage"]["w"]] = x_slice
    return indices
