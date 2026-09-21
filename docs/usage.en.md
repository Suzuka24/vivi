# Usage guide

## Explore and open files

Click the vivi activity-bar icon and enter a directory on the **extension host**. In a Remote SSH window this is a path on the server. The toolbar provides parent/home/refresh, create, delete, hidden-file visibility, terminal path insertion, and sorting. The path field offers recent directories. Scroll to load further entries; the filter applies to the currently loaded list.

Double-click a managed image or choose **Open** to add it as a Frame in the most recently used vivi editor tab. Choose **Open in New Tab** for a separate editor tab. The new tab stays in the current editor group. Set `vivi.managedExtensions` to decide which file suffixes vivi takes over; a file removed from the list follows the editor's normal opening behavior. Run **vivi: Configure Menu Visibility** to show or hide first- and second-level image viewer menu items; all are shown by default.

For a multidimensional file, **Open As…** lists each TIFF series or FITS HDU, its source shape, and editable target axes. Every source letter must occur once; joining letters folds dimensions (`uv h w`), while moving a detected channel before `h w` turns it into stack slices (`c h w`). Validation stays in the dialog so the expression can be corrected.

**Open Folder as Stack** offers **Only 2D images** and **All image planes**, then accepts an optional `H W` filter. Blank uses the first qualifying image. Later files with another height or width are skipped. The lower-right status shows the source filename and original plane number. Explorer **Remove** permanently deletes files or folders recursively after confirmation.

## Frames and slices

**Layout** in the sidebar manages file Frames. A new tab starts in single-Frame mode. Use the display icon to switch to tiled mode, drag Frame rows to reorder them, and set optional row or column counts. The eye toggle determines visibility. The adjacent lock toggle determines whether that Frame joins synchronization. Select a Frame before editing it; in a tile layout, the arrow keys move selection between visible Frames. Only selected lock participants receive synchronized B&C, LUT, view, zoom, slice, or selection changes. A Frame joining an existing lock group adopts the group's enabled settings. In tiled mode, visible locked Frames commit a synchronized display update together.

Right-click a Layout Frame to rename, duplicate, or close it. Copies append at the end with a `[copy N]` suffix. The Frame list scrolls with the mouse wheel.

The second toolbar row contains the series selector and slice slider, slice number, playback control, and FPS. Use the arrows to step or hold them for repeated stepping at the selected FPS. The slider moves directly to a slice. FITS files can offer multiple HDUs; TIFF can offer multiple series. Not every TIFF axis convention can be inferred perfectly, so check the displayed series and shape.

## Display and measurements

**Adjust** contains Auto methods, Min/Max numeric fields and sliders, Brightness/Contrast sliders, stretch mode, LUT, invert, and a toggleable Curve display. These display settings belong to the active Frame and persist while moving through its slices. They do not rewrite the source pixels. Threshold remains available from Image → Adjust; it displays raw pixel values between Min and Max as white, with values outside as black. Layout's All lock and Unlock only change which Frames participate, leaving B&C, LUT, View, Zoom, and Slice choices unchanged.

The viewer toolbar includes ImageJ-style region and drawing tools, magnifier, hand, pointer, montage, orthogonal views, histogram, measure, and common flip/rotate actions. Mouse-drawn regions snap to integer pixel positions; the numeric selection dialog accepts fractional coordinates. The status line shows pixel position and value. Orthogonal views require one stack Frame in single mode; dragging any crosshair updates all three sections, and right-clicking XZ or YZ duplicates that section as a 2D Frame. Use **Analyze → Histogram** to choose bins and a range before opening a draggable result window with sample count and summary statistics. Some ImageJ commands remain unavailable or intentionally simplified; see [menu coverage](imagej-menu-coverage.md).

## Generated results

Pixel operations under Image, Process, and Analyze Skeleton replace the current Frame's temporary working copy. Undo/Redo records up to ten operations. Compatible stack operations preserve untouched slices; geometry operations transform the stack. Commands with multiple outputs, including Split Channels and Stack to Images, create additional Frames. Montage lays out original grayscale values as TIFF pixels; **Scale (%)** changes each tile's dimensions. The source file on disk remains unchanged.

## Common settings

| Setting | Purpose |
| --- | --- |
| `vivi.pythonPath` | Absolute Python interpreter path on the extension host. |
| `vivi.defaultPath` | Explorer's initial host directory. |
| `vivi.managedExtensions` | File suffixes opened by vivi on double-click. |
| `vivi.explorerContextMenu` | Checkboxes for visible first- and second-level viewer menu items, including planned commands; all shown by default. Also available through **vivi: Configure Menu Visibility**. |
| `vivi.losslessCompression` | On by default: reversibly byte-shuffle and zlib-compress source-dtype pixel bytes. Off: transmit the source bytes directly. Incompressible data automatically stays raw. |
| `vivi.lossyCompression` | Off by default. When enabled, encode floating-point previews from source files above the threshold with a lossy codec. Source files and host-side measurements remain exact. |
| `vivi.lossyMinFileMiB` | Source file threshold for lossy previews, 128 MiB by default. Only strictly larger files qualify. |
| `vivi.lossyMethod` | ZFP by default; alternatives are float16, bfloat16, and 64×64 blockwise 8/12/16-bit quantization. Integer and nonfinite planes use the original-byte path. |
| `vivi.lossyTolerance` | ZFP absolute error target as a fraction of the preview plane's min–max range; 0.0001 by default. Not used by other methods. |
| `vivi.defaultFps` | New viewers default to 24 FPS; playback and held slice arrows use the current FPS (1–60). |
| `vivi.mouseShortcuts` | Gestures: `wheel` steps slices (up = previous, down = next), `shift+wheel` zooms at the pointer, `mod+wheel` zooms at image center, `shift+click` uses the selected tool in Orthogonal Views, `middle+drag` pans, `alt+right+drag` adjusts brightness and contrast, and `doubleclick` fits. `mod` means Command on macOS and Ctrl on Windows/Linux. Set another chord such as `alt+wheel` or leave empty to disable. |
| `vivi.keyboardShortcuts` | Action shortcuts such as `shift+p` or `ctrl+shift+h`; macOS Command is `cmd`. Defaults: `=` / `-` zoom, Left/Right switch slices, Up/Down switch Frames, `m` toggles Single/Tile, and `shift+p` selects Pointer, `h` selects Hand, and `o` selects Oval. An empty string disables an action. Shortcuts work while the image view, but no text field, has focus. |

See [installation](installation.en.md) for backend setup and [privacy](../PRIVACY.md) for host storage and data transfer.

After the active slice appears, vivi immediately preloads all stack slices outward from it and builds a display-ready image for each one. The ready count includes decoding and coloring. There is no preview-size or memory-budget limit. **Image → Copy Image** and the image context menu copy the visible rendered image region, including on-screen selections and overlays, as a PNG image.

The lossy and lossless switches are independent: eligible previews are first encoded by the lossy method, then optionally compressed reversibly. The receiver decodes in reverse order. With lossy previews enabled, on-screen pixel readings reflect approximate preview values; turn it off when exact readings are needed. The threshold uses source file size, rather than stack memory size. SZ3 compressed the reference TIFF more tightly, but is not offered until a compatible browser decoder is available. See the [reference TIFF benchmark](../worklog/2026-09-20/203247_lossy-preview-compression.md).
