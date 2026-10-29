# 安装、Python 环境、Remote SSH 与故障排查

[English](installation.en.md) · [使用指南](usage.md) · [加载与传输](loading-and-transport.md)

## 环境要求

- 桌面版 VS Code 或 Cursor；浏览器版不支持本机 Python 和 Node.js worker。
- 每台实际读取图像的扩展主机上安装 Python 3.10 或更新版本。
- `vivi.pythonPath` 指向的 Python 环境中安装 [`backend/requirements.txt`](../backend/requirements.txt) 的全部依赖，包括 NumPy、Pillow、Astropy、tifffile、Zarr 2、numcodecs、imagecodecs、OpenCV 和 zfpy。
- 足够的主机内存和客户端 Webview 内存容纳完整预览。vivi 当前不对 stack 设置预览尺寸或总缓存预算。

vivi 不内置 Python，也不会自动安装 Python 包。源文件在扩展主机读取；Remote SSH 时只把预览和结果传到本机。

## 安装扩展

公开上架后，可在 VS Code/Cursor 扩展页面搜索发布者 **Suzuka24** 的 **vivi**。开发版可从仓库构建：

```bash
pnpm install
pnpm run package
```

然后选择 **扩展 → … → 从 VSIX 安装**，选中 `vivi-*.vsix`。

Remote SSH 窗口中，要在扩展页面选择 **安装到 SSH: [服务器名]**。只在笔记本安装无法让远端扩展主机读取服务器路径。

## 安装 Python 后端

在 vivi 将运行的主机执行：

```bash
python3 -m venv ~/.venvs/vivi
~/.venvs/vivi/bin/python -m pip install --upgrade pip
~/.venvs/vivi/bin/python -m pip install -r backend/requirements.txt
```

Windows 示例：

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

商店或 VSIX 安装没有源码工作区时，可从[源码仓库](https://github.com/Suzuka24/vivi/blob/main/backend/requirements.txt)下载 requirements 文件。

## 选择 Python 解释器

在设置中搜索 **Vivi: Python Path**。`vivi.pythonPath` 默认留空，此时依次尝试旧版 `imageViewer.pythonPath`，然后尝试系统 `python3`（Windows 为 `python`）。为了避免不同终端、Conda 或 Remote SSH 会话使用不同解释器，建议填写绝对路径，例如：

```text
/Users/name/.venvs/vivi/bin/python
/home/name/.venvs/vivi/bin/python
C:\Users\name\venvs\vivi\Scripts\python.exe
```

设置作用域很重要：

- **用户**：本地所有窗口；
- **远程 [SSH: host]**：只作用于该服务器的扩展主机；
- **工作区**：只作用于当前项目，并可能覆盖用户/远程值。

服务器上的下拉框为空不代表 vivi 没有 Python；它表示当前作用域没有显式路径，vivi 会尝试 fallback。服务器终端中的 `conda env list` 只显示 Conda 环境，不会显示通过 `python -m venv` 创建的 `~/.venvs/vivi`。

配置后运行命令面板中的 **vivi: Check Python Backend**。它会显示实际解释器、Python 版本和依赖导入结果。修改路径或安装依赖后运行 **Developer: Reload Window**。

## Remote SSH 工作方式

本地和每台服务器都独立安装扩展和 Python 依赖：

1. 本地窗口使用本机 `vivi.pythonPath`；
2. `SSH: hyh-batchcom2` 使用该远程作用域中的路径；
3. 另一台 SSH 主机有自己的扩展和设置，不能继承前一台服务器的环境。

如果本地可打开而某服务器报 `ModuleNotFoundError`，通常是该服务器选中的 Python 缺依赖。用诊断输出中的**同一个解释器**执行：

```bash
/path/to/python -m pip install -r backend/requirements.txt
/path/to/python -c "import numpy, tifffile, zarr, imagecodecs, astropy"
```

## 从开发版升级

0.6.1 起发布者从 `local-science` 改为 `Suzuka24`。`local-science.vivi` 和 `Suzuka24.vivi` 是两个不同扩展 ID。请在每个本地/远程主机安装新版，卸载旧版，然后重载窗口。`vivi.*` 设置键保持不变。

## 故障排查

- **没有 vivi 图标或查看器：**确认扩展安装在当前本地/远程主机且已启用，然后运行 **Developer: Reload Window**。
- **设置中找不到 `vivi.pythonPath`：**确认当前启用的是 `Suzuka24.vivi`，在设置搜索 `@ext:Suzuka24.vivi python`，并检查用户、远程和工作区三个标签。
- **`ModuleNotFoundError: zarr` 或其他模块：**当前解释器没有完整安装 requirements。不要只在另一个终端环境中安装；使用诊断显示的绝对 Python 路径执行 pip。
- **远端路径被当成本地路径：**确认当前窗口已连接 Remote SSH，且 vivi 安装在该 SSH 主机。
- **TIFF axes 或 Zarr 相关错误：**requirements 固定兼容的 `tifffile==2025.3.30`、`zarr==2.18.3`；混装 Zarr 3 或不同 tifffile 可能改变 axes 行为，建议在独立 venv 中重装。
- **大型图像很慢：**查看 **输出 → vivi** 的阶段计时。TIFF/FITS 通常支持区域/页面读取；PNG/JPEG/BMP/GIF/视频可能整帧解码。可按网络与误差要求调整无损/有损设置。
- **视频打不开：**远端 OpenCV build 可能缺 codec；尝试受支持图像或在该主机安装兼容 codec。
- **请求超时：**提高 `vivi.requestTimeoutSeconds` 后重新打开；超时会停止 worker。

提交可复现问题前请参阅 [SUPPORT.md](../SUPPORT.md)。

## 卸载

在每个安装过的本地或 Remote SSH 主机卸载 `Suzuka24.vivi`。Python venv 和数据文件不会自动删除；不再需要时单独移除。vivi 卸载不会删除源图像。
