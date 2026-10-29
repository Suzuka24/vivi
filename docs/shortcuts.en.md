# Default shortcuts and mouse controls

[中文](shortcuts.md) · [Back to usage](usage.en.md)

## Editing shortcuts

Open VS Code/Cursor Settings and search for `vivi.keyboardShortcuts` or `vivi.mouseShortcuts`. A keyboard action accepts one key or modifiers joined with `+`:

- single keys: `f`, `=`, `arrowleft`, `enter`, `f2`;
- combinations: `shift+a`, `ctrl+arrowup`, `alt+m`, `cmd+p`;
- supported modifiers: `shift`, `ctrl`, `alt`/`option`, `cmd`/`meta`;
- an empty string `""` disables an action;
- modifiers match exactly: a `shift+a` binding does not also trigger on plain `a`.

Shortcuts work while the vivi viewer or Explorer/Layout/Adjust has focus. They remain active after a range slider or native scrollbar is used. They pause while editing a text/number field or select control, preventing typing from becoming an image command. Tooltips update immediately after settings change.

`vivi.keyboardShortcuts` exposes all configurable tools and menu actions, currently 131 entries. The tables below list only active defaults; every other action starts unbound.

## Image tools and view

| Action | Setting key | Default |
| --- | --- | --- |
| Fit | `fit` | `F` |
| Hand | `hand` | `H` |
| Pointer | `pointer` | `P` |
| Rectangle selection | `roi` | `R` |
| Oval selection | `oval` | `O` |
| Straight line | `line` | `L` |
| Magnifying glass | `zoomTool` | `G` |
| Measure | `measure` | `M` |
| Clear all selections | `clear` | `C` |
| Undo image operation | `undoTransform` | `Z` |
| Zoom in | `zoomIn` | `=` |
| Zoom out | `zoomOut` | `-` |

Redo (`redoTransform`) has no default. Polygon, Freehand, Angle, Text, 1:1, Curve toggle, and most menu commands also start unbound.

## Slices, Frames, and Layout

| Action | Setting key | Default |
| --- | --- | --- |
| Play/pause slices | `play` | `Enter` |
| Previous slice | `previousSlice` | `Arrow Left` |
| Next slice | `nextSlice` | `Arrow Right` |
| Previous Frame | `previousFrame` | `Arrow Up` |
| Next Frame | `nextFrame` | `Arrow Down` |
| Move Frame up | `moveFrameUp` | `Shift+Arrow Up` |
| Move Frame down | `moveFrameDown` | `Shift+Arrow Down` |
| Move Frame to top | `moveFrameFirst` | `Ctrl+Arrow Up` |
| Move Frame to bottom | `moveFrameLast` | `Ctrl+Arrow Down` |
| Toggle Single/Tile | `toggleFrameDisplay` | `D` |
| Rename active Frame/Explorer item | `rename` | `F2` |

Slice arrow keys match the toolbar controls. Holding a toolbar slice button uses the selected FPS; holding a keyboard key follows the operating system's key-repeat behavior.

## Adjust

| Action | Setting key | Default |
| --- | --- | --- |
| Active-slice Auto | `autoCuts` | `A` |
| Active-slice Reset | `resetCuts` | `S` |
| Current-stack S-Auto | `stackAutoCuts` | `Shift+A` |
| Current-stack S-Reset | `stackResetCuts` | `Shift+S` |

Auto/Reset use selected area pixels in the active slice when an area selection exists. S-Auto/S-Reset scan the current 3D stack and apply one result to every slice.

## Default mouse gestures

These entries live in `vivi.mouseShortcuts`. `mod` means Command on macOS and Ctrl on Windows/Linux.

| Action | Setting key | Default gesture |
| --- | --- | --- |
| Step slices | `slice` | `wheel`: up = previous, down = next |
| Zoom around pointer | `zoomAtPointer` | `shift+wheel` |
| Zoom around image center | `zoomAtCenter` | `mod+wheel` |
| Pan enlarged image vertically | `verticalPan` | `space+wheel` |
| Pan enlarged image horizontally | `horizontalPan` | `alt+wheel` |
| Use selected tool in Orthogonal Views | `orthogonalTool` | `space+click` or drag |
| Hand pan | `handDrag` | `middle+drag` |
| Adjust Brightness/Contrast | `contrastDrag` | `alt+right+drag` |

Set a mouse gesture to an empty string to disable it. Avoid assigning one identical gesture to several actions because the first matching action consumes the event.

## Modifiers while drawing

- `Shift`: constrain Rectangle/Oval to a square/circle; constrain a new Line or edited endpoint to horizontal, vertical, or 45°.
- In Orthogonal Views, an ordinary left drag moves a crosshair. Hold `Space` to use the selected tool. `Space+Shift+drag` retains the same Shift constraints.
- `Alt+right-drag` adjusts B&C without opening the image context menu; a short right-click still opens the menu.

## Fixed Explorer operations

These file-management inputs are not part of `vivi.keyboardShortcuts`:

| Operation | Default input |
| --- | --- |
| Select a range | `Shift+click` |
| Toggle multiselect | `Ctrl+click` / macOS `Command+click` |
| Copy, cut, paste | `Ctrl/Command+C`, `X`, `V` |
| Permanently delete | `Delete` |
| Open | `Enter` or double-click |
| Rename | `F2` |
| Move items | Drag selected items onto a target folder |
| Insert terminal paths | Middle-click |
| Autosize a column | Double-click the divider after Name, Size, or Last modified |
