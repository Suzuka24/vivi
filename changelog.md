# Changelog

## 0.6.22 (development build; not published)
- Benchmark all 101 slices of the reference float32 TIFF with ZFP, SZ3, float16, bfloat16, and 8/12/16-bit block quantization; record size, error, and timing in the worklog.
- Add optional lossy preview transport with source-file size threshold and method selection. Default to ZFP when enabled; the lossy switch remains off by default.
- Keep the existing reversible compression as an independent second stage and decode both stages in the Webview. Preserve original files and host-side analysis values.

## 0.6.21 (development build; not published)
- Align portable vivi defaults with the current Cursor profile, including a 256-million-pixel full-frame decoder limit, direct zoom keys, and slice/tool bindings.
- Configure Up/Down to switch Frames and M to toggle Single/Tile; remove unconditional Shift+plus/minus zoom handling so shortcut settings take precedence.

## 0.6.20 (development build; not published)
- Add Chinese explanations alongside English descriptions for every vivi setting and each menu-visibility checkbox.

## 0.6.19 (development build; not published)
- Finish coloring each stack slice during preload so the ready count represents display-ready images and first playback does not flash blank frames.
- Reuse the colored image while its display settings remain unchanged, avoiding repeated pixel conversion on every slice switch.

## 0.6.18 (development build; not published)
- Transfer preview pixels as binary bytes in the source dtype. Optional reversible byte shuffle and zlib compression reduces Remote SSH traffic; incompressible data stays uncompressed.
- Preserve FITS stored pixel dtype and byte order during transfer, with display scaling applied only after decode.
- Remove preview dimension and preload memory limits; preload all stack slices immediately after the active slice is ready.
- Copy the visible rendered image to the system clipboard from the Image menu or image context menu.
- Offer checkboxes for all first- and second-level menu items, including planned commands, in `vivi.explorerContextMenu`.

## 0.6.17 (development build; not published)
- Add a checkable Explorer context-menu chooser and include Open Folder as Stack among its default-visible actions.
- Document modifier-key shortcut syntax and bind the Pointer tool to Shift+P by default.

## 0.6.16 (development build; not published)
- Highlight the Orthogonal Views toolbar button while the view is active, and clear it when the view closes.

## 0.6.15 (development build; not published)
- Display errors as dismissible overlays above the image without changing the viewport geometry.

## 0.6.14 (development build; not published)
- Match the visible size of the eight right-hand toolbar icons to the earlier drawing tools.

## 0.6.13 (development build; not published)
- Simplify the eight right-hand toolbar icons, match their visible stroke weight to the earlier tools, and remove the divider within this group.

## 0.6.12 (development build; not published)
- Make All lock and Unlock change only Frame membership, leaving B&C, LUT, View, Zoom, and Slice synchronization choices intact.
- Rename the floating B&C window and Adjust toggle to Curve, and remove Threshold from the Adjust sidebar.
- Replace the requested tool icons with larger SVGs and align orthogonal sections at the same displayed pixel scale.

## 0.6.11 (development build; not published)
- Align XY, YZ, and XZ at the same pixel scale; transpose YZ and allow either section to be duplicated as a 2D Frame.
- Add menu actions to the toolbar, arbitrary rotation with preview and undo, and Frame context actions.
- Expand image folders as stacks with a 2D-only or all-planes choice and per-plane source labels.
- Compact Explorer rows, remove files and directories permanently on confirmation, and expose viewer action shortcuts in settings.

## 0.6.10 (development build; not published)
- Add an ADJUST button to show or hide the B&C graph.
- Match tile pan movement to mouse movement in screen pixels.
- Add synchronized XY, YZ, and XZ Orthogonal Views for a single stack Frame.

## 0.6.9 (development build; not published)
- Scroll the entire Layout content area natively so frames beyond the visible portion remain reachable with the mouse wheel.
- Preserve Layout's scroll position when Frame state updates rebuild the list.

## 0.6.8 (development build; not published)
- Make the Layout Frame list respond directly to the mouse wheel and retain its scroll position when sidebar state refreshes.
- Avoid drawing an empty cached preview immediately after an in-place stack flip or rotation while its pixels are being recolored.
- Number repeated Frame titles automatically and let Layout, the image context menu, and Image > Rename edit the same display title without renaming source files.

## 0.6.7 (development build; not published)
- Limit background preloading for very large stacks to nearby slices, keeping the current view responsive over Remote SSH.
- Hold the slice previous/next buttons to step continuously at the configured FPS.
- Scroll long Frame lists within Layout while keeping its controls visible.

## 0.6.6 (development build; not published)
- Scroll the Layout view and show slice controls only when the selected Frame has more than one plane.
- Keep raw preview pixels in the stack cache so Adjust, Auto, LUT, and display transforms can update previews locally without rereading the image.
- Import a folder as a naturally sorted, lazy image sequence with source filenames shown as slice labels.
- Accept a typed zoom percentage and handle Shift+plus/minus zoom shortcuts.

## 0.6.5 (development build; not published)
- Use a shared eight-character number formatter in Adjust, B&C, plots, measurements, and pixel readouts.
- Update the B&C curve during Adjust slider movement and center the minimized B&C bar.
- Show a restore icon on minimized Results and Histogram windows and align the viewer toolbar controls.
- Select Pan for new images; anchor wheel zoom at the pointer and toolbar or keyboard zoom at the image center.

## 0.6.4 (development build; not published)
- Align the two viewer toolbar rows and remove the redundant Series label.
- Keep Layout frame rows visible and select Pointer when a new image opens.
- Rework Adjust around fixed pixel bounds, editable slider values, and a linked B&C curve with endpoint values.
- Shrink histogram results and dock minimized result windows along the viewer bottom edge.
- Format displayed measurements using compact decimal or scientific notation according to length.

## 0.6.2 (development build; not published)
- Split Explorer, Layout, and Adjust into native collapsible sidebar sections; compact the file filter into a toolbar button.
- Move series and slice controls to a second viewer toolbar row; select the third or fourth FITS axis while preserving the other coordinate.
- Align fixed-width B&C sliders, keep their values in sync with ImageJ-style brightness/contrast mapping, and show a collapsible histogram/transfer curve on the canvas.
- Correct range slider padding, constrain histogram windows and format results, and keep errors visible for at least two seconds.
- Add a fixed four-axis FITS fixture and regression test.

## 0.6.1
- Prepare the public `Suzuka24.vivi` identity, marketplace icon, and listing metadata. The former `local-science.vivi` development ID is a separate installation.
- Add bilingual README, installation and usage guides, plus privacy, support, security, contribution, and publishing documentation.

## 0.6.0
- Add stack assembly, splitting, montage with pixel-preserving scale, reslicing, projection, profiles, measurements and statistics.
- Keep flips and right-angle rotations in the active Frame with ten undo steps while preserving stack slices.
- Add four B&C sliders and curve, detailed configurable histogram windows, extra Color previews, and original-size plus ImageJ-padded FFT.
- Compact Layout and Adjust, move slice controls to the image toolbar, and add editable keyboard shortcuts.

## 0.5.8
- Replace Explorer paging with continuous scroll loading; fix the flex layout so long lists remain visible and scrollable.
- Give each Frame a separate lock participation checkbox and copy enabled lock settings when a Frame joins the group.
- Freeze each new Frame's automatically computed brightness range across slice changes.
- Group Adjust toggles with Auto/Reset, distinguish single/tiled icons, and remove the Focus LUT tool and menu text tooltips.
- Add all 68 LUT tables from the official ImageJ LUT archive, plus image type/scale/rotation, more Process commands, and basic Analyze result controls.
- Record menu coverage and known differences from ImageJ.

## 0.5.5
- Add independent Explorer/Layout/Adjust collapsible sections, readable Frame names, per-Frame close, and compact tile toggle.
- Fix drawing on the active Frame in tiled mode, selection clearing, menu hover behavior, immediate tooltips, and ImageJ zoom steps.
- Make Duplicate create server-side pixel copies with selection cropping, current-slice or stack range controls; add crop, flips, arithmetic, normalize, and Z projection as generated Frames.
- Add Gaussian Blur, Median, and Unsharp Mask filters; preserve nonrectangular ROI geometry on copied Frames.

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
# 0.5.2

- Added a compact recent-path dropdown next to the Explorer path field. Successful directory visits are saved per workspace, most recent first, up to 20 paths.
