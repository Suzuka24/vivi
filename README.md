# vivi

[简体中文](README.zh-CN.md) · [Installation](docs/installation.en.md) · [Usage](docs/usage.en.md) · [ImageJ menu coverage](docs/imagej-menu-coverage.md)

vivi is a scientific image and data viewer for VS Code and Cursor. Browse files on the extension host and inspect large images, stacks, and hyperstacks without downloading the original file to your laptop. When you connect through Remote SSH, Python reads and processes the data on the remote host; the editor receives previews and results.

## Highlights

- Open PNG, JPEG, TIFF, FITS, and other supported image formats. TIFF stacks, hyperstacks, and multi-HDU FITS files expose their slices or series. Basic AVI/MP4/MOV/MKV previews are also supported when a suitable codec is available.
- Navigate any accessible host path from vivi's Explorer, including paths outside the workspace. Choose which extensions vivi opens by default with `vivi.managedExtensions`; other files follow the editor's normal behavior.
- Keep several files as Frames in one editor tab, switch or tile them, reorder them, and optionally synchronize display parameters across selected Frames. **Open in New Tab** creates an independent tab.
- Adjust brightness and contrast, stretch, thresholds, and LUTs; draw and measure regions; inspect pixel values and histograms. The ImageJ-style menu also includes stack conversion, montage, reslice, projection, profiles, and selected image-processing commands.
- Cache previews for smooth browsing. The memory limit is configurable; images beyond it may still need host-side reads while navigating.

**vivi is under active development.** Menu entries shown in gray are unavailable, and several implemented commands are simplified relative to ImageJ. See the [feature coverage and differences](docs/imagej-menu-coverage.md) before relying on a particular analysis command.

## Quick install

Requirements: VS Code or Cursor with a desktop or Remote SSH extension host, Python 3.10+, and the packages in [`backend/requirements.txt`](backend/requirements.txt) **on that host**. vivi runs in the workspace extension host and does not install Python packages automatically.

1. Install vivi from the extension marketplace when a listing is available, or use **Extensions → … → Install from VSIX…** with a package built from this repository.
2. Install the backend packages into a Python environment on the host that will read the images:

   ```bash
   python3 -m venv ~/.venvs/vivi
   ~/.venvs/vivi/bin/python -m pip install -r backend/requirements.txt
   ```

   If you installed only the VSIX, download [`backend/requirements.txt`](backend/requirements.txt) separately or clone this repository on that host. On Windows, use the corresponding `python.exe` in your virtual environment.

3. Set `vivi.pythonPath` to that environment's **absolute** Python path in the relevant local or remote settings. Run **vivi: Check Python Backend** from the Command Palette.
4. Select the vivi activity-bar icon, browse to a folder, and double-click an image. In Remote SSH, install vivi **on the remote extension host** and repeat the Python setup there.

Upgrading from development builds: the publisher changes from `local-science` to `Suzuka24` in version 0.6.1. `local-science.vivi` and `Suzuka24.vivi` are different extension IDs; remove the old build after installing the new one. Settings named `vivi.*` remain the same.

See [installation, upgrade, and troubleshooting](docs/installation.en.md) for details.

## Documentation

- [Installation and Remote SSH](docs/installation.en.md) · [中文](docs/installation.md)
- [Viewer and Explorer guide](docs/usage.en.md) · [中文](docs/usage.md)
- [ImageJ menu coverage and differences](docs/imagej-menu-coverage.md)
- [Privacy and local data](PRIVACY.md), [support](SUPPORT.md), and [security](SECURITY.md)
- [Contributing](CONTRIBUTING.md), [publishing](PUBLISHING.md), and [changelog](changelog.md)

## License

[MIT](LICENSE). vivi is an independent project; it is not affiliated with or endorsed by the ImageJ/Fiji, SAOImage DS9, VS Code, or Cursor teams. Their names belong to their respective owners.
