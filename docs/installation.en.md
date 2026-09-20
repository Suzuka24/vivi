# Installation, Remote SSH, and troubleshooting

## Requirements

- A desktop installation of VS Code or Cursor. vivi is a workspace extension and uses the host where the workspace extension host runs.
- Python 3.10 or newer on each host where you want to read images.
- The packages listed in [`backend/requirements.txt`](../backend/requirements.txt), installed in the Python environment selected by `vivi.pythonPath`. A video codec supported by OpenCV is needed for the corresponding video files.
- Enough host disk space for generated TIFF results and enough host memory for the selected preview cache. The original file is read on the host; previews travel through the editor connection.

vivi does not include Python or install its Python dependencies. It does not support VS Code for the Web because its worker uses local Python and Node.js APIs.

## Install the extension

When the public listings are available, search for **vivi** by publisher **Suzuka24** in VS Code or Cursor Extensions and choose **Install**. Until then, clone this repository, run `pnpm install` and `pnpm run package`, then choose **Extensions → … → Install from VSIX…** and select `vivi-*.vsix`.

For a Remote SSH workspace, install the extension **in SSH: [your host]** in the Extensions view. The remote extension host runs the Python worker; installing vivi only on your laptop does not enable remote file access.

## Install the Python backend

Run these commands on the host where vivi will run (locally for local workspaces, remotely for Remote SSH). In the repository root:

```bash
python3 -m venv ~/.venvs/vivi
~/.venvs/vivi/bin/python -m pip install -r backend/requirements.txt
```

If you installed from a marketplace rather than cloning the repository, download the requirements file from the [source repository](https://github.com/Suzuka24/vivi/blob/main/backend/requirements.txt) first. Windows users can create a virtual environment with `py -3 -m venv .venv` and use its `Scripts/python.exe`.

Set `vivi.pythonPath` to the absolute path of that interpreter in VS Code/Cursor Settings. The default is `python3` on macOS/Linux or `python` on Windows. Open a Remote SSH window and set the value in **Remote [SSH host]** settings for the remote interpreter; local and remote settings may differ. Run **vivi: Check Python Backend** from the Command Palette and inspect the **vivi** Output channel if the check reports an error.

## Upgrade from development builds

Version 0.6.1 changes the extension publisher from `local-science` to `Suzuka24`. The resulting extension IDs, `local-science.vivi` and `Suzuka24.vivi`, are separate installations. Install the new package on each relevant host, then uninstall `local-science.vivi` to avoid two vivi Explorer views or conflicting editor registrations. Configuration keys beginning with `vivi.` are unchanged. Reload the editor window after installation or upgrade.

## Troubleshooting

- **No vivi icon or viewer:** confirm the extension is enabled on the correct local/remote host, then run **Developer: Reload Window**.
- **Python process exits or a module is missing:** run **vivi: Check Python Backend** and verify the exact interpreter configured in `vivi.pythonPath` can import the packages. Review the **vivi** Output channel.
- **Remote path opens locally or cannot be found:** check that the current window is connected through Remote SSH and that vivi is installed on that SSH host. Explorer paths refer to the extension host filesystem.
- **Large image takes time to pan or scrub:** FITS and TIFF normally use host-side region reads; PNG/JPEG and video may require full decoding. Pixels transfer in their source dtype; `vivi.losslessCompression` toggles reversible compression. `vivi.maxDecodedPixels` still guards formats requiring full-frame decoding.
- **A video does not open:** its codec may not be available in the remote OpenCV build. Try a supported image or install a compatible codec on that host.

For reproducible bugs, see [SUPPORT.md](../SUPPORT.md).

## Uninstall

Uninstall `Suzuka24.vivi` from each host on which it was installed. The virtual environment and any data files remain on the host; remove them separately if you no longer need them. vivi does not delete source images when uninstalled.
