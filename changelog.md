# Changelog

## 0.7.22 (development build; not published)

- Show a dedicated image icon for files that vivi can open while preserving the existing icons for folders and all other file types.

## 0.7.21 (development build; not published)

- Keep configurable shortcuts active after HTML range sliders or native scrollbars receive focus, while continuing to suppress shortcuts during text and select editing.
- Use VS Code's built-in Seti mappings for file-type icons, Codicon folder and fallback file shapes, and a fixed icon column so every file name starts at the same position.

## 0.7.20 (development build; not published)

- Apply Stretch only to normalized display brightness after Minimum/Maximum; keep Auto/Reset, histograms, measurements, profiles, thresholds, and pixel readouts on real pixel values, and draw the selected nonlinear function in Curve.
- Add Power, Asinh, Sinh, and Histogram Equalization to Process > Math; add Exp and Abs to Stretch; use consistent operation labels in both menus.
- Keep Layout and Explorer context menus above scroll containers and make oversized menus scroll within the Webview viewport.
- Restore the numbered `000` through `005` LUT entries alongside their equivalent clean names.

## 0.7.19 (development build; not published)

- Combine every uniquely named LUT from ImageJ's built-ins, LUT archive, current distribution, and Fiji, including Physics; remove archive-only `000-` through `005-` ordering prefixes and sort the combined menu by name.
- Treat stretch as a non-destructive virtual pixel transform used consistently by rendering, Adjust/Curve, Auto/Reset, Histogram, Measure, pixel readouts, and profiles, while keeping Process pixel operations on the original image values.
- Keep the selected stretch active when Auto, Reset, S-Auto, or S-Reset is used.

## 0.7.18 (development build; not published)

- Match ImageJ Brightness/Contrast Auto with a full-pixel 256-bin histogram, dominant-background rejection, and progressively stronger repeated Auto clicks.
- Match ImageJ Reset ROI behavior: ignore area selections, restore 0–255 for 8-bit/RGB data, and use the full current frame range for 16/32-bit data.
- Apply the same ImageJ algorithms to S-Auto and S-Reset across every slice in the current stack.

## 0.7.17 (development build; not published)

- Calculate Auto and Reset from every pixel inside the current frame selection, falling back to the full current frame when no area is selected.
- Calculate S-Auto and S-Reset from every selected pixel across all slices in the current stack.

## 0.7.16 (development build; not published)

- Make Reset and the Adjust Minimum/Maximum slider endpoints use the exact minimum and maximum across every pixel in the currently displayed slice.
- Add Frame reorder actions to the Layout context menu and right-align the Columns/Rows controls.
- Show current configurable keyboard shortcuts in button tooltips and refresh them immediately when settings change.
- Keep work logs local by excluding `worklog/` from Git.

## 0.7.15 (development build; not published)

- Add Layout buttons and shortcuts for moving the current Frame up, down, to the top, or to the bottom. Frame navigation now works while Layout has focus, and extension-level commands keep the four reorder shortcuts available outside vivi webviews.
- Combine B&C with LUT synchronization and View with Zoom synchronization in Layout locks.
- Keep the final Adjust controls on one row and add spacing between the Layout toolbar and Frame list.
- Fix Adjust Minimum and Maximum slider bounds so every stack slice uses its own pixel range.

## 0.7.14 (development build; not published)

- Add S-Auto and S-Reset controls for calculating B&C limits from the current three-dimensional stack, including the selected stack axis in higher-dimensional data.
- Add editable defaults for F2 rename, O oval selection, C clear selection, Enter playback, A/S frame B&C, and Shift+A/Shift+S stack B&C. Z remains Undo-only and Redo has no default binding.
- Keep the five ADJUST action buttons aligned with consistent height and spacing.

## 0.7.13 (development build; not published)

- Align the LAYOUT Frame navigation, display mode, Columns, and Rows controls to the display mode control height.
- Make a short press on either slice arrow move exactly one slice; continuous FPS-paced stepping now starts only after a 300 ms hold.

## 0.7.12 (development build; not published)

- Replace per-slice request/response preloading with one continuous stack stream. Decode and construct slices without blocking navigation, then reveal the stack atomically after every slice is ready.
- Show meaningful stack loading progress and a spinner on the corresponding LAYOUT Frame while loading.
- Add selectable lossless transport methods, defaulting to Zstandard level 1 with Byte Shuffle; lossy encoding remains an independent prior stage and defaults to ZFP when enabled.

## 0.7.11 (development build; not published)

- Remember the most recently opened file or entered child directory per Explorer folder, with persistent styling distinct from hover and selection.
- Preserve Shift constraints for rectangle, oval, and line tools invoked with Space while Orthogonal Views is active.
- Use vertical previous/next Frame icons in LAYOUT.
- Make Plot Profile and Plot Z-axis Profile charts resizable and responsive, with clipped curves, boxed axes, grid lines, numeric ticks, and hover coordinates.

## 0.7.10 (development build; not published)

- Migrate the former `shift+click` Orthogonal Views tool gesture saved in user, workspace, or workspace-folder settings to `space+click` while preserving all other mouse bindings.

## 0.7.9 (development build; not published)

- Change the default shortcuts to Pointer=P, Rectangle=R, Oval=C, Measure=M, and Single/Tile display=D.
- Use Space+mouse for selected tools while Orthogonal Views is enabled.
- Draw locked selections on every tile's orthogonal XY view using the synchronized viewport.

## 0.7.8 (development build; not published)

- Restore the latest sequential per-frame stack transport used before whole-stack batch payloads.
- Apply flip and rotate operations to every locked Frame when View synchronization is enabled.
- Make pan, zoom, locked viewport changes, and Shift-assisted tools affect tile orthogonal views.

## 0.7.7 (development build; not published)

- Restored the pre-0.7.4 whole-stack single-payload transport path and ready counter.
- Repaint all visible locked tile Frames together when B&C or color settings change.

## 0.7.6 (development build; not published)
- Prioritize stack transfer speed by sending one complete binary payload without application-level Webview chunks. Because VS Code does not expose partial receipt of one message, loading uses an indeterminate animation instead of a misleading percentage.
- Update locked tile Frames immediately from their preloaded slice canvases during slider dragging, arrow stepping, held-button playback, and normal playback.
- Support Orthogonal Views in Tile display. Each enabled tile shows aligned XY, YZ, and XZ views, and Selection locking synchronizes all three crosshair coordinates and view updates across compatible stack Frames.

## 0.7.5 (development build; not published)
- Show a numeric percentage inside the stack loading bar. Progress combines server-side slice reads, chunked Remote SSH transfer, and local slice canvas construction while preserving all-at-once display.
- Preserve Orthogonal Views per Frame when switching Frames. Selection locking now synchronizes the orthogonal X, Y, and Z crosshair coordinates between compatible stack Frames.

## 0.7.4 (development build; not published)
- Replace the persistent stack ready count with a temporary loading progress bar. It is indeterminate while the complete stack is read and transferred, reports construction progress after arrival, and disappears when every slice is ready.

## 0.7.3 (development build; not published)
- Restore one shared B&C range for an entire stack. Slice changes refresh the Curve histogram and source range while keeping Minimum, Maximum, and the display transfer line unchanged. Auto and Reset use the current slice, restricted to the active area selection when present, then apply the result to the full stack.

## 0.7.2 (development build; not published)
- Reverse the default slice wheel direction: scroll up selects the previous slice and scroll down selects the next slice.

## 0.7.1 (development build; not published)
- Load each stack as one source-ordered binary payload and construct every slice before first display. Preserve source dtype and apply optional lossy and lossless transport stages to the whole payload.
- Reslice stacks along the active straight, segmented, or freehand line, including the endpoint of each segment.
- Apply supported Process operations only inside area selections, show ImageJ-style selection geometry in the status bar, and explain the 8-bit binary requirement when Skeletonize is unavailable.
- Default montage columns to the rounded square root of the selected slice count.
- Add interactive profile plots with hover values, wheel zoom, drag pan, and double-click reset. Use fixed-width borderless tables for stack measurements and statistics.

## 0.7.0 (development build; not published)
- Add **Open As…** for multidimensional TIFF and FITS data. It lists every series or HDU, shows source shape and axis letters, validates rearrange-style target expressions, folds adjacent axes such as `uv h w`, and lets a channel axis become stack slices with `c h w`.
- Let folder stacks optionally filter all candidate images by a user-provided `H W`; when omitted, the first qualifying image defines the required size. Mismatched files are skipped.
- Refresh all visible locked tile Frames as one visual update for B&C, LUT, Slice, View, and Zoom. Add real-time Selection synchronization and render synchronized selections in every tile.
- Apply Image, Process, FFT, Binary, Math, Filter, and Analyze Skeleton pixel operations to the current Frame with ten-step undo/redo; retain untouched stack slices where the operation keeps a compatible plane layout.
- Add channel merge/stack-to-RGB controls, Convolve, Remove Outliers, Watershed, and Analyze Skeleton. Keep Split Channels as a multi-output command.
- Keep the official ImageJ 1.x source in a local, untracked `ref/ImageJ` checkout for implementation comparison; exclude `ref/` from Git and VSIX packages.

## 0.6.24 (development build; not published)
- Make wheel scroll slices upward to the next slice, Shift+wheel zoom at pointer, and platform modifier+wheel zoom at image center. Double-click fits the image.
- Configure mouse gestures and default FPS (24), rename Pan to Hand (H), and bind Oval to O. Held slice arrows repeat at FPS.
- Let Shift activate the selected tool in Orthogonal Views; show flip state on toolbar buttons and a processing notice during transforms, including undo/redo.

## 0.6.23 (development build; not published)
- Repaint cached stack slices promptly when B&C, stretch, LUT, invert, or threshold changes, including synchronized Frames; keep the existing canvas visible until its replacement is complete.
- Transform cached canvases with flips and 90-degree rotations so already loaded slices remain ready to display. Newly arriving preload results pick up the latest display settings.

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
