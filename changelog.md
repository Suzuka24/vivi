# Changelog

## 0.4.3
- Give each file Frame its own persistent view and display settings while navigating slices.
- Add independent Frame locks for B&C, color/LUT, view, zoom, and slice. Changes to the active Frame immediately synchronize locked settings.
- Refresh tiled Frame previews after locked display or slice changes and highlight the active Frame.

## 0.4.2
- Add Explorer toolbar actions for Trash, hidden files, inserting selected paths into the terminal, and whole-directory sorting by name, size, or modification time.

## 0.4.1
- Cache full previews for images within the preview limit, so panning never needs to fetch newly exposed pixels.
- Keep previously rendered regions of larger images and prepare a full-image overview behind detailed regions.

## 0.4.0
- Keep Explorer state when switching views; show reliable icon tooltips and distinct sidebar color.
- Separate file Frames from TIFF/FITS slices: regular Open adds to the current Vivi tab, and Open in New Tab opens an independent tab in the same editor group.
- Add single/tiled layouts, Frame navigation, blink, lock, clone, reordering, and close controls.
- Expand ImageJ-style toolbar and menu catalog; add display scale/stretch options, B&C dialogs, ROI shapes, and Montage as a generated Frame.

## 0.3.0
- Compact MobaXterm-style file toolbar and configurable Explorer context menu.
- ImageJ-style two-row image controls and no persistent right metadata pane.
- Background stack preview preloading with frame cache and no blank canvas during frame changes.
- Open images in a reusable side preview, with an explicit new-tab action.

## 0.2.2
- Fix native Explorer handoff to Cursor editors for unmanaged files.

## 0.2.1
- Route unmanaged PNG/JPEG and MP4 to Cursor native previews; other formats use the default editor.

## 0.2.0
- Rename the extension to vivi and make file takeover configurable.
- Keep server-side image decoding, add fixed multi-format regression fixtures, and compact the viewer UI.
# 0.5.0

- Moved slice navigation, frame layout and B&C controls into the Explorer sidebar.
- Added draggable frame order, per-frame visibility, grid dimensions, frame locks and hold-to-play slice buttons.
- Added hierarchical ImageJ-style menus, selection handles, tool variant popups, an image context menu and more LUTs.
- Ignored local `.vscode` settings in Git.
# 0.5.1

- Added an ImageJ-style context menu when right-clicking an active ROI, plus Specify Selection and ROI Properties dialogs.
- Added fractional coordinate input for rectangles, ovals and vertex-based selections; mouse drawing and handle edits snap to integer pixels.
- Added ROI overlays, a compact ROI Manager, spline fitting and mask creation as a new Frame.
