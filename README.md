# vivi

[简体中文](README.zh-CN.md) · [Installation](docs/installation.en.md) · [Usage](docs/usage.en.md) · [Shortcuts](docs/shortcuts.en.md) · [Loading and transport](docs/loading-and-transport.en.md) · [ImageJ menu coverage](docs/imagej-menu-coverage.md)

vivi is a scientific image and data viewer for VS Code and Cursor. It browses, reads, and processes files on the extension host. In a Remote SSH window, Python decodes images on the server and the editor receives only display pixels and analysis results, so the original large file does not need to be downloaded first.

## Highlights

- **Scientific images and multidimensional data:** open PNG, JPEG, BMP, TIFF, FITS, and related formats. Browse TIFF stacks, hyperstacks, multiple series, and multi-HDU FITS. **Open As…** shows the source shape and accepts axis expressions such as `uv h w` and `c h w`. **Open Folder as Stack…** can keep only 2D images or unfold every image plane, with an optional common `H W` filter. AVI, MP4, MOV, and MKV previews work when the host OpenCV build has the required codec.
- **Host filesystem Explorer:** browse any accessible local or Remote SSH host path. Multiselect, copy, cut, paste, recursive delete, drag-to-move, terminal path insertion, hidden files, sorting, and filtering are supported. Name, Size, and Last modified columns can be resized, double-click autosized, and remembered per directory. The most recently opened file or entered child directory has a persistent highlight distinct from hover.
- **Frames, stacks, and tiled synchronization:** manage several Frames in one editor tab, switch between Single and Tile, reorder, duplicate, rename, or close them. Locked Frames synchronize B&C with LUT, View with Zoom, Slice, and Selection in real time, including Tile and Orthogonal Views. Navigate slices with the wheel, slider, arrow keys, held controls, or FPS playback.
- **ImageJ-style display and interaction:** Rectangle, Oval, Line, Polygon, Freehand, Angle, Text, Magnifier, Hand, and Pointer tools; editable zoom percentages and zoom steps through 25600%; pointer-centered or image-centered zoom; horizontal and vertical panning. Orthogonal Views synchronize XY, XZ, and YZ crosshairs and can duplicate XZ/YZ sections as 2D Frames.
- **B&C, LUTs, and selections:** Minimum and Maximum are shared by a stack while the Curve histogram follows the active slice. Auto/Reset can use the current frame or area selection; S-Auto/S-Reset scan the current 3D stack. The automatic-range menu includes ImageJ Auto and one DS9-compatible ZScale using DS9's standard 0.25/600/120 defaults. Stretch changes display mapping only, while processing, measurements, and pixel readouts use real pixels. Selections participate in measurements, profiles, reslice, and local image processing.
- **Processing and analysis:** Image, Process, and Analyze menus cover type conversion, color channels, montage, reslice, projection, flip/rotate, filters, binary morphology, Math, FFT, Histogram, Measure, Statistics, Plot Profile, Z-axis Profile, Skeleton, and ROI Manager workflows. Pixel operations replace the current Frame's working copy with ten-step undo; the source file is never overwritten. **File → Header** shows every FITS HDU header, retains the source Header across in-place operations, and warns when active geometry may no longer match the WCS.
- **Large-file loading and transport:** cancellable HTTP streaming is the default. A stack uses one continuous response with backpressure and browser double buffering, and appears only after every slice is constructed. Preview bytes retain source dtype. Lossless transport defaults to Zstandard level 1 plus Byte Shuffle; optional lossy preview encoding is independent. Payloads for the three most recent single images can be reused briefly in memory, with source changes invalidating reuse. Source file handles are released immediately after loading.
- **Configurable operation:** keyboard shortcuts and mouse gestures are editable in Settings. See [shortcuts and mouse controls](docs/shortcuts.en.md) for defaults and combination syntax. First- and second-level viewer menu items can also be hidden individually.

**vivi is under active development.** Gray menu entries are unavailable, and some commands still expose fewer parameters or outputs than ImageJ. Check [feature coverage and differences](docs/imagej-menu-coverage.md) before relying on a specific analysis workflow.

## Quick install

Requirements: desktop VS Code or Cursor, Python 3.10+, and the packages in [`backend/requirements.txt`](backend/requirements.txt) on the **extension host that reads the images**. vivi does not install Python packages automatically.

1. Install from a marketplace listing when available, or clone the repository, run `pnpm install` and `pnpm run package`, then choose **Extensions → … → Install from VSIX…**.
2. Create a Python environment on the local or Remote SSH host and install the backend dependencies:

   ```bash
   python3 -m venv ~/.venvs/vivi
   ~/.venvs/vivi/bin/python -m pip install -r backend/requirements.txt
   ```

3. Set `vivi.pythonPath` to that interpreter's absolute path in the appropriate **User, Local, Remote, or Workspace** settings scope. Run **vivi: Check Python Backend** from the Command Palette.
4. Select the vivi activity-bar icon, browse to a directory, and double-click an image. A Remote SSH window needs both vivi and the Python dependencies on the remote extension host.

Upgrading from development builds: version 0.6.1 changes the publisher from `local-science` to `Suzuka24`. They are different extension IDs; remove the old extension after installing the new one. See [installation, upgrade, and troubleshooting](docs/installation.en.md).

## Documentation

- [Installation, Python, and Remote SSH](docs/installation.en.md) · [中文](docs/installation.md)
- [Viewer, Explorer, and analysis guide](docs/usage.en.md) · [中文](docs/usage.md)
- [Default shortcuts and mouse controls](docs/shortcuts.en.md) · [中文](docs/shortcuts.md)
- [Large-file loading, compression, transport, and cache](docs/loading-and-transport.en.md) · [中文](docs/loading-and-transport.md)
- [ImageJ menu coverage and differences](docs/imagej-menu-coverage.md)
- [Privacy and local data](PRIVACY.md), [support](SUPPORT.md), and [security](SECURITY.md)
- [Contributing](CONTRIBUTING.md), [publishing](PUBLISHING.md), and [changelog](changelog.md)

## License

[MIT](LICENSE). vivi is an independent project; it is not affiliated with or endorsed by the ImageJ/Fiji, SAOImage DS9, VS Code, or Cursor teams. Their names belong to their respective owners.
