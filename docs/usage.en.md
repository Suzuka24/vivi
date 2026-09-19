# Usage guide

## Explore and open files

Click the vivi activity-bar icon and enter a directory on the **extension host**. In a Remote SSH window this is a path on the server. The toolbar provides parent/home/refresh, create, delete, hidden-file visibility, terminal path insertion, and sorting. The path field offers recent directories. Scroll to load further entries; the filter applies to the currently loaded list.

Double-click a managed image or choose **Open** to add it as a Frame in the most recently used vivi editor tab. Choose **Open in New Tab** for a separate editor tab. The new tab stays in the current editor group. Set `vivi.managedExtensions` to decide which file suffixes vivi takes over; a file removed from the list follows the editor's normal opening behavior. Set `vivi.explorerContextMenu` to show, hide, or reorder context-menu actions.

## Frames and slices

**Layout** in the sidebar manages file Frames. A new tab starts in single-Frame mode. Use the display icon to switch to tiled mode, drag Frame rows to reorder them, and set optional row or column counts. The eye toggle determines visibility. The adjacent lock toggle determines whether that Frame joins synchronization. Select a Frame before editing it; in a tile layout, the arrow keys move selection between visible Frames. Only selected lock participants receive synchronized B&C, LUT, view, zoom, or slice changes. A Frame joining an existing lock group adopts the group's enabled settings.

The second toolbar row contains the series selector and slice slider, slice number, playback control, and FPS. Use the arrows to step or hold them for repeated stepping at the selected FPS. The slider moves directly to a slice. FITS files can offer multiple HDUs; TIFF can offer multiple series. Not every TIFF axis convention can be inferred perfectly, so check the displayed series and shape.

## Display and measurements

**Adjust** contains Auto methods, Min/Max numeric fields and sliders, Brightness/Contrast sliders, stretch mode, LUT, invert, threshold, and a transfer curve. These display settings belong to the active Frame and persist while moving through its slices. They do not rewrite the source pixels. Threshold displays raw pixel values between Min and Max as white, with values outside as black.

The viewer toolbar includes ImageJ-style region and drawing tools, magnifier, pan, and pointer. Mouse-drawn regions snap to integer pixel positions; the numeric selection dialog accepts fractional coordinates. The status line shows pixel position and value. Use **Analyze → Histogram** to choose bins and a range before opening a draggable result window with sample count and summary statistics. Some ImageJ commands remain unavailable or intentionally simplified; see [menu coverage](imagej-menu-coverage.md).

## Generated results

Image operations such as Duplicate, Crop, Montage, projections, and many Process commands create a new Frame. Montage lays out original grayscale values as TIFF pixels; **Scale (%)** changes the pixel dimensions of each tile. Orthogonal flips and rotations instead replace the current Frame's display content. Undo/Redo records up to ten such transforms. The source file on disk remains unchanged; generated images use temporary files on the extension host and can be exported with the relevant File command.

## Common settings

| Setting | Purpose |
| --- | --- |
| `vivi.pythonPath` | Absolute Python interpreter path on the extension host. |
| `vivi.defaultPath` | Explorer's initial host directory. |
| `vivi.managedExtensions` | File suffixes opened by vivi on double-click. |
| `vivi.explorerContextMenu` | Visible Explorer context-menu commands and their order. |
| `vivi.preloadMaxMiB` | Approximate decoded preview cache limit for stacks. |
| `vivi.maxPreviewSize` | Largest transmitted preview dimension. |
| `vivi.keyboardShortcuts` | Single-key viewer shortcuts by action, edited in `settings.json`. |

See [installation](installation.en.md) for backend setup and [privacy](../PRIVACY.md) for host storage and data transfer.
