# Usage guide

## Explore and open files

Click the vivi activity-bar icon and enter a directory on the **extension host**. In a Remote SSH window this is a path on the server. The toolbar provides parent/home/refresh, create, delete, hidden-file visibility, terminal path insertion, and sorting. The path field offers recent directories. Scroll to load further entries; the filter applies to the currently loaded list.

Double-click a managed image or choose **Open** to add it as a Frame in the most recently used vivi editor tab. Choose **Open in New Tab** for a separate editor tab. The new tab stays in the current editor group. Set `vivi.managedExtensions` to decide which file suffixes vivi takes over; a file removed from the list follows the editor's normal opening behavior. Run **vivi: Configure Menu Visibility** to show or hide first- and second-level image viewer menu items; all are shown by default.

**Open Folder as Stack** offers **Only 2D images** (skip multidimensional files) and **All image planes** (flatten 2D/3D files). The lower-right status shows the source filename and original plane number. Files must share width, height, dtype, and channel count. Explorer **Remove** permanently deletes files or folders recursively after confirmation.

## Frames and slices

**Layout** in the sidebar manages file Frames. A new tab starts in single-Frame mode. Use the display icon to switch to tiled mode, drag Frame rows to reorder them, and set optional row or column counts. The eye toggle determines visibility. The adjacent lock toggle determines whether that Frame joins synchronization. Select a Frame before editing it; in a tile layout, the arrow keys move selection between visible Frames. Only selected lock participants receive synchronized B&C, LUT, view, zoom, or slice changes. A Frame joining an existing lock group adopts the group's enabled settings.

Right-click a Layout Frame to rename, duplicate, or close it. Copies append at the end with a `[copy N]` suffix. The Frame list scrolls with the mouse wheel.

The second toolbar row contains the series selector and slice slider, slice number, playback control, and FPS. Use the arrows to step or hold them for repeated stepping at the selected FPS. The slider moves directly to a slice. FITS files can offer multiple HDUs; TIFF can offer multiple series. Not every TIFF axis convention can be inferred perfectly, so check the displayed series and shape.

## Display and measurements

**Adjust** contains Auto methods, Min/Max numeric fields and sliders, Brightness/Contrast sliders, stretch mode, LUT, invert, and a toggleable Curve display. These display settings belong to the active Frame and persist while moving through its slices. They do not rewrite the source pixels. Threshold remains available from Image → Adjust; it displays raw pixel values between Min and Max as white, with values outside as black. Layout's All lock and Unlock only change which Frames participate, leaving B&C, LUT, View, Zoom, and Slice choices unchanged.

The viewer toolbar includes ImageJ-style region and drawing tools, magnifier, pan, pointer, montage, orthogonal views, histogram, measure, and common flip/rotate actions. Mouse-drawn regions snap to integer pixel positions; the numeric selection dialog accepts fractional coordinates. The status line shows pixel position and value. Orthogonal views require one stack Frame in single mode; dragging any crosshair updates all three sections, and right-clicking XZ or YZ duplicates that section as a 2D Frame. Use **Analyze → Histogram** to choose bins and a range before opening a draggable result window with sample count and summary statistics. Some ImageJ commands remain unavailable or intentionally simplified; see [menu coverage](imagej-menu-coverage.md).

## Generated results

Image operations such as Duplicate, Crop, Montage, projections, and many Process commands create a new Frame. Montage lays out original grayscale values as TIFF pixels; **Scale (%)** changes the pixel dimensions of each tile. Orthogonal flips and rotations instead replace the current Frame's display content. Undo/Redo records up to ten such transforms. The source file on disk remains unchanged; generated images use temporary files on the extension host and can be exported with the relevant File command.

## Common settings

| Setting | Purpose |
| --- | --- |
| `vivi.pythonPath` | Absolute Python interpreter path on the extension host. |
| `vivi.defaultPath` | Explorer's initial host directory. |
| `vivi.managedExtensions` | File suffixes opened by vivi on double-click. |
| `vivi.explorerContextMenu` | Checkboxes for visible first- and second-level viewer menu items, including planned commands; all shown by default. Also available through **vivi: Configure Menu Visibility**. |
| `vivi.losslessCompression` | On by default: reversibly byte-shuffle and zlib-compress source-dtype pixel bytes. Off: transmit the source bytes directly. Incompressible data automatically stays raw. |
| `vivi.keyboardShortcuts` | Action shortcuts such as `shift+p` or `ctrl+shift+h`; macOS Command is `cmd`. Pointer defaults to `shift+p`; an empty string disables an action. Shortcuts work while the image view, but no text field, has focus. |

See [installation](installation.en.md) for backend setup and [privacy](../PRIVACY.md) for host storage and data transfer.

After the active slice appears, vivi immediately preloads all stack slices outward from it without a preview-size or memory-budget limit. **Image → Copy Image** and the image context menu copy the visible rendered image region, including on-screen selections and overlays, as a PNG image.
