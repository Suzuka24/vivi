# Usage guide

[中文](usage.md) · [Shortcuts](shortcuts.en.md) · [Loading and transport](loading-and-transport.en.md) · [ImageJ menu coverage](imagej-menu-coverage.md)

## Explorer: browse and manage files

Select the vivi activity-bar icon to browse the **extension host**. A local window reads local paths; a Remote SSH window reads server paths. The toolbar provides parent, home, refresh, new folder, new file, delete, hidden-file visibility, terminal path insertion, sorting, and filtering. The path field lists recent directories, and scrolling to the bottom loads further entries.

File icons follow Cursor/VS Code conventions where possible, while images that vivi can open use a dedicated outline icon. The most recently opened file or entered child directory keeps a persistent highlight distinct from hover; this state is remembered separately for each directory.

The Name, Size, and Last modified columns support:

- drag resizing;
- divider double-click to calculate the minimum complete width from **every entry** in the directory, shrinking an oversized column as well as growing a narrow one;
- independent per-directory width memory;
- reliable ellipsis clipping inside the Name column.

Explorer supports common file operations:

- `Shift+click` selects a range and `Ctrl/Command+click` toggles items;
- `Ctrl/Command+C`, `X`, and `V` copy, cut, and paste; `Delete` permanently removes;
- dragging selected files or folders onto a folder moves them;
- middle-click inserts selected paths into the active terminal;
- `F2` renames and `Enter` opens;
- **Remove Permanently…** recursively deletes files or folders after confirmation.

## Open images and multidimensional data

Double-click a suffix listed in `vivi.managedExtensions`, or choose **Open**, to add it as a Frame to the most recently used vivi tab. **Open in New Tab** creates an independent tab. Removing a suffix from `vivi.managedExtensions` restores the editor's normal opener.

PNG, TIFF, JPEG, BMP, and FITS are managed by default, case-insensitively. AVI, MP4, MOV, and MKV work when the host OpenCV build has a matching codec. PNG/JPEG/BMP/GIF/video commonly require full-frame decoding and are guarded by `vivi.maxDecodedPixels`; TIFF and FITS usually support page or region access.

### Open As…

For a 3D or higher-dimensional file, **Open As…** lists every TIFF series or FITS HDU with its source shape, axis letters, and target shape. Target expressions use rearrange-style rules:

- every source axis letter must occur exactly once;
- joining letters folds dimensions, for example `u v h w` to `uv h w`;
- a channel normally ends the shape as `h w c`; moving it before `h w`, as in `c h w`, treats channels as grayscale stack slices;
- invalid input reports an error without closing the dialog.

Normal **Open** retains automatic inference. A 2D image opens directly; 3D data uses one slice bar; higher-dimensional data adds an axis selector for the same bar.

### Open Folder as Stack…

Choose one mode:

- **Only 2D images** ignores non-2D images;
- **All image planes** unfolds every plane from 2D and multidimensional files.

An optional space-separated `H W` filter follows. Blank uses the first qualifying image, and later mismatches are skipped. Files are processed in natural order; the slice status shows the source filename and original plane number.

### Header and image information

**File → Header** opens a movable, resizable, minimizable, pinnable, and closable window. FITS displays the complete header for every HDU; formats without headers show an explicit message. **Image → Show Info…** reports the shape, dtype, series/HDU, and metadata recognized by vivi.

## Frames, Layout, and slices

Layout manages Frames in the current vivi tab. The top previous/next controls change the active Frame, and the display button switches Single/Tile. Drag rows or use Up, Down, Top, and Bottom controls or shortcuts to reorder. A Frame context menu can rename, duplicate, reorder, or close. Copies append with `[copy N]`; duplicate source titles receive `(2)`, `(3)`, and so on. Rename changes only the display title.

The eye controls visibility and the lock controls synchronization membership. **All lock** and **Unlock** only change membership, not the following synchronization categories:

- **B&C** synchronizes Minimum, Maximum, Brightness, and Contrast, including LUT;
- **View** synchronizes center and zoom;
- **Slice** synchronizes the axis and position;
- **Selection** synchronizes selections and Orthogonal Views crosshair coordinates.

Visible locked Frames update during the same interaction in Tile mode, including slice slider dragging, keys, held controls, playback, B&C, LUT, pan, zoom, flip, rotate, and selection editing. The Layout list scrolls with the mouse wheel.

The second toolbar row appears only when the current Frame has extra axes. It contains series/HDU, axis selection, slice slider, slice number, playback, and FPS:

- a short arrow click moves exactly one slice; repeated FPS stepping starts after a 300 ms hold;
- the default is 24 FPS, editable in the viewer and through `vivi.defaultFps` for new viewers;
- wheel up selects the previous slice and wheel down the next slice by default.

A loading Frame shows a spinner in Layout. In HTTP mode, closing that row aborts the transfer and backend request. A completed stack appears atomically after every slice is constructed. See [loading and transport](loading-and-transport.en.md).

## Toolbar, zoom, and pan

The toolbar contains Rectangle, Oval, Polygon, Freehand, Line, Angle, Text, Magnifier, Hand, Pointer, Montage, Orthogonal Views, Histogram, Measure, horizontal/vertical flip, and 90° left/right rotate.

- new images default to Hand; `H` selects Hand, `P` Pointer, and `G` Magnifier;
- `F` runs Fit, `1:1` restores original scale, and the zoom field accepts an arbitrary percentage;
- zoom steps extend through 25600%; toolbar and keyboard zoom around image center, while `Shift+wheel` zooms around the pointer;
- `Command+wheel` on macOS or `Ctrl+wheel` on Windows/Linux zooms around image center;
- on an enlarged image, `Space+wheel` pans vertically and `Alt+wheel` horizontally using ImageJ-style distances;
- middle-button drag pans, and `Alt+right-drag` changes B&C;
- canvas double-click is intentionally not bound to Fit.

See [shortcuts and mouse controls](shortcuts.en.md) for every default and editing syntax.

## Adjust, Curve, and LUT

Adjust provides the auto method, Minimum, Maximum, Brightness, Contrast, Stretch, LUT, Invert, and five controls: Auto, Reset, S-Auto, S-Reset, and Curve.

- a stack shares one Minimum/Maximum and display transfer curve; changing slices does not replace that window;
- Curve updates the histogram and source range for the active slice while drawing the shared B&C function;
- **Auto** uses the active slice, restricted to an area selection when present, and repeated clicks follow ImageJ-style progressive enhancement;
- **Reset** restores the type range for 8-bit/RGB and the active slice range for 16/32-bit data, with ImageJ-style area-selection handling;
- **S-Auto/S-Reset** scan the current 3D stack; for higher dimensions they use the currently selected stack axis; on a single image they equal Auto/Reset;
- direct Minimum/Maximum input may exceed the current source range; the slider stays at its endpoint while the curve still uses the entered value;
- Curve can be toggled or minimized and repaints continuously during B&C changes.

Stretch is a non-destructive display mapping after Minimum/Maximum normalization. Available mappings include Linear, Log, Exp, Sqrt, Square, Power, Asinh, Sinh, Abs, and Histogram Equalization. Histogram, Measure, profiles, pixel readouts, and Process operations still use real pixels. Threshold lives under **Image → Adjust** and changes display only; **Process → Binary → Make Binary** creates actual binary pixels.

LUTs combine ImageJ, Fiji, and vivi sources. Numbered favorites begin with `000 Gray`, `001 MPL Plasma`, `002 Physics`, and `003 Phase`. Flip and Orthogonal Views toolbar buttons use a selected highlight to show the active Frame state.

## Selections and Orthogonal Views

Mouse-created selections snap to integer pixels; the numeric Specify dialog accepts decimals. The status bar reports geometry appropriate to the selection, including position, width/height, area, angle, and length. Shift constraints include:

- square/circle constraints for Rectangle and Oval;
- horizontal, vertical, or 45° directions when drawing a Line or editing either endpoint;
- the same constraints while holding `Space` to use a tool in Orthogonal Views.

Smooth, Sharpen, Find Edges, filters, and other selection-aware Process operations modify only pixels in an area selection. Line, Segmented Line, and Freehand Line drive Plot Profile and Reslice. Selection lock updates compatible Frames continuously.

Orthogonal Views works in Single and Tile. XY is the main image, XZ is attached below, and YZ to the right; all crosshairs and the slice position stay synchronized. A normal click or drag moves a crosshair; hold `Space` to invoke the selected toolbar tool. Right-click XZ or YZ to duplicate that section as a 2D Frame. Orthogonal state is stored per Frame and returns when that Frame is revisited.

## Processing, analysis, and result windows

See [ImageJ menu coverage](imagej-menu-coverage.md) for available commands and differences. General rules:

- pixel operations modify the current Frame's temporary working copy and never overwrite the source;
- compatible stack operations preserve all slices, while geometry operations transform the complete stack;
- naturally multi-output commands such as Split Channels and Stack to Images create Frames;
- pixel operations keep a ten-step Undo/Redo history; `Z` defaults to Undo only and Redo has no default shortcut;
- Flip/Rotate participates in View synchronization; arbitrary Rotate has preview and transformations show a busy status;
- Montage defaults its column count to the rounded square root of the slice count;
- Reslice follows the active Line, Segmented Line, or Freehand Line;
- Skeletonize explains its 8-bit binary image requirement when unavailable;
- native-size FFT and ImageJ-style power-of-two FFT are separate commands.

Histogram, Measure, Measure Stack, Statistics, and Profile results use movable windows. They can be resized, minimized, pinned, or closed; minimized bars align along the bottom edge. Numeric output uses one compact formatter. Plot Profile and Z-axis Profile adapt to window size and provide axes, grid, hover coordinates, wheel zoom, drag pan, and double-click reset.

**Image → Copy Image** and the image context menu copy the visible rendered image to the system clipboard, including selections and overlays, similar to taking a screenshot of the image display region.

## Settings

| Setting | Default and purpose |
| --- | --- |
| `vivi.pythonPath` | Empty; tries legacy `imageViewer.pythonPath`, then system `python3`/`python`. An absolute extension-host path is recommended. |
| `vivi.defaultPath` | `~`; initial Explorer directory. |
| `vivi.maxDecodedPixels` | `256000000`; guard for full-frame PNG/JPEG/BMP/GIF/video decoding. TIFF/FITS usually use page or region access. |
| `vivi.requestTimeoutSeconds` | `120`; a timeout stops the worker, which restarts when an image is reopened. |
| `vivi.managedExtensions` | Common PNG/TIFF/JPEG/BMP/FITS suffixes; controls double-click takeover. |
| `vivi.explorerContextMenu` | All first- and second-level viewer menu items are visible by default; edit in Settings or **vivi: Configure Menu Visibility**. |
| `vivi.transportMode` | `http`; cancellable and reports byte progress for fixed payloads. `postMessage` is a compatibility path whose in-flight single messages cannot be interrupted. |
| `vivi.recentCacheSeconds` | `20`; retain payloads for the three most recent single images in client memory. Expiry or source changes invalidate them; `0` disables. |
| `vivi.losslessCompression` | On; apply reversible compression after optional lossy encoding. |
| `vivi.losslessMethod` | `zstd1-shuffle`; alternatives: `zstd3-shuffle`, `zlib1-shuffle`. |
| `vivi.lossyCompression` | Off; affects qualifying floating-point previews only, not source files or host-side measurements. |
| `vivi.lossyMinFileMiB` | `128`; source-size threshold for lossy preview encoding. |
| `vivi.lossyMethod` | `zfp`; alternatives include float16, bfloat16, and blockwise 8/12/16-bit quantization. |
| `vivi.lossyTolerance` | `0.0001`; ZFP absolute error target as a fraction of the active plane's min–max range. |
| `vivi.defaultFps` | `24`; playback and held-slice speed, range 1–60. |
| `vivi.mouseShortcuts` | Editable wheel, zoom, pan, Orthogonal Views tool, Hand, and B&C gestures. |
| `vivi.keyboardShortcuts` | 131 configurable actions; unbound actions default to empty. See [shortcuts](shortcuts.en.md) for syntax and active defaults. |

See [installation](installation.en.md) for backend setup, [loading and transport](loading-and-transport.en.md) for the data path, and [privacy](../PRIVACY.md) for data boundaries.
