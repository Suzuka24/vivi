# Installation, Python, Remote SSH, and troubleshooting

[中文](installation.md) · [Usage](usage.en.md) · [Loading and transport](loading-and-transport.en.md)

## Requirements

- Desktop VS Code or Cursor; browser editions cannot run the local Python and Node.js workers.
- Python 3.10 or newer on every extension host that reads images.
- Every package in [`backend/requirements.txt`](../backend/requirements.txt) installed in the interpreter selected by `vivi.pythonPath`, including NumPy, Pillow, Astropy, tifffile, Zarr 2, numcodecs, imagecodecs, OpenCV, and zfpy.
- Enough host and client Webview memory for complete previews. vivi currently has no stack preview-size or total-cache budget.

vivi does not bundle Python or install Python packages automatically. Source files are read on the extension host; Remote SSH sends only previews and results to the client.

## Install the extension

When a public listing is available, search Extensions for **vivi** by publisher **Suzuka24**. To build a development VSIX:

```bash
pnpm install
pnpm run package
```

Then choose **Extensions → … → Install from VSIX…** and select `vivi-*.vsix`.

In Remote SSH, choose **Install in SSH: [host]**. Installing only on the laptop does not allow the remote extension host to read server paths.

## Install the Python backend

Run on the host where vivi will execute:

```bash
python3 -m venv ~/.venvs/vivi
~/.venvs/vivi/bin/python -m pip install --upgrade pip
~/.venvs/vivi/bin/python -m pip install -r backend/requirements.txt
```

Windows example:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

If a marketplace or VSIX install has no source checkout, download the requirements file from the [source repository](https://github.com/Suzuka24/vivi/blob/main/backend/requirements.txt).

## Select the Python interpreter

Search Settings for **Vivi: Python Path**. `vivi.pythonPath` defaults to empty, which tries legacy `imageViewer.pythonPath` and then system `python3` (`python` on Windows). An absolute path avoids differences between terminals, Conda activation, and Remote SSH sessions:

```text
/Users/name/.venvs/vivi/bin/python
/home/name/.venvs/vivi/bin/python
C:\Users\name\venvs\vivi\Scripts\python.exe
```

Settings scope matters:

- **User** affects local windows;
- **Remote [SSH: host]** affects that server's extension host;
- **Workspace** affects one project and may override User/Remote values.

An empty selector on a server does not mean no Python exists; it means that scope has no explicit path and vivi will try its fallbacks. `conda env list` shows Conda environments only, not a `python -m venv` environment such as `~/.venvs/vivi`.

Run **vivi: Check Python Backend** after configuration. It reports the actual interpreter, Python version, and dependency imports. Run **Developer: Reload Window** after changing the path or packages.

## Remote SSH model

The local machine and every server independently need the extension and Python dependencies:

1. a local window uses local `vivi.pythonPath`;
2. `SSH: hyh-batchcom2` uses that Remote scope;
3. another SSH host has separate extension state and settings.

If local works but one server reports `ModuleNotFoundError`, the interpreter selected on that server is missing a package. Use the **same absolute interpreter** shown by diagnostics:

```bash
/path/to/python -m pip install -r backend/requirements.txt
/path/to/python -c "import numpy, tifffile, zarr, imagecodecs, astropy"
```

## Upgrade from development builds

Version 0.6.1 changes the publisher from `local-science` to `Suzuka24`. `local-science.vivi` and `Suzuka24.vivi` are different extension IDs. Install the new build on every local/remote host, uninstall the old one, and reload. Existing `vivi.*` setting keys are unchanged.

## Troubleshooting

- **No vivi icon or viewer:** confirm the extension is installed and enabled on the current local/remote host, then run **Developer: Reload Window**.
- **Cannot find `vivi.pythonPath`:** confirm `Suzuka24.vivi` is enabled, search Settings for `@ext:Suzuka24.vivi python`, and inspect User, Remote, and Workspace tabs.
- **`ModuleNotFoundError: zarr` or another package:** the selected interpreter lacks the complete requirements. Install with the absolute interpreter from diagnostics, not whichever environment happens to be active in another terminal.
- **Remote path opens locally:** confirm the window is connected through Remote SSH and vivi is installed on that SSH host.
- **TIFF axes or Zarr error:** requirements pin compatible `tifffile==2025.3.30` and `zarr==2.18.3`. Mixing Zarr 3 or another tifffile can change axes behavior; reinstall in a dedicated venv.
- **Large image is slow:** inspect **Output → vivi** stage timings. TIFF/FITS usually support region/page reads; PNG/JPEG/BMP/GIF/video may require full decoding. Adjust lossless/lossy settings according to bandwidth and error requirements.
- **Video does not open:** the remote OpenCV build may lack its codec.
- **Request timeout:** increase `vivi.requestTimeoutSeconds` and reopen; timeout stops the worker.

See [SUPPORT.md](../SUPPORT.md) before reporting a reproducible issue.

## Uninstall

Uninstall `Suzuka24.vivi` from every local or Remote SSH host where it was installed. Python environments and data remain and must be removed separately. Uninstalling vivi never deletes source images.
