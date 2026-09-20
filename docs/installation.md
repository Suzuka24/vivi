# 安装、Remote SSH 与故障排查

## 环境要求

- 桌面版 VS Code 或 Cursor。vivi 是工作区扩展，读取文件的主机就是工作区扩展主机。
- 每台需要读取图像的主机上有 Python 3.10 或更新版本。
- 在 `vivi.pythonPath` 指向的 Python 环境中安装 [`backend/requirements.txt`](../backend/requirements.txt) 所列依赖。视频预览还需要 OpenCV 支持对应的编解码器。
- 主机有足够的磁盘空间存放生成的 TIFF 结果，也有足够内存容纳所设的预览缓存。原始文件留在主机上读取，编辑器连接只传输预览。

vivi 不内置 Python，也不会自动安装 Python 依赖。由于使用本机 Python 与 Node.js API，不支持浏览器版 VS Code。

## 安装扩展

公开上架后，在 VS Code 或 Cursor 的扩展页面搜索发布者 **Suzuka24** 的 **vivi** 并安装。上架之前，可克隆本仓库，运行 `pnpm install`、`pnpm run package`，然后选择 **扩展 → … → 从 VSIX 安装**，选中 `vivi-*.vsix`。

使用 Remote SSH 时，在扩展页面选择安装到 **SSH: [服务器名]**。Python worker 在远端扩展主机运行；只在笔记本安装 vivi，无法直接访问远端文件。

## 安装 Python 后端

在 vivi 即将运行的主机上执行以下命令。本地工作区在本机运行；Remote SSH 工作区在服务器上运行。进入仓库根目录后：

```bash
python3 -m venv ~/.venvs/vivi
~/.venvs/vivi/bin/python -m pip install -r backend/requirements.txt
```

如果是从商店安装、没有克隆仓库，请先从[源码仓库](https://github.com/Suzuka24/vivi/blob/main/backend/requirements.txt)下载 requirements 文件。Windows 可用 `py -3 -m venv .venv`，然后使用虚拟环境中的 `Scripts/python.exe`。

在 VS Code/Cursor 设置中将 `vivi.pythonPath` 设为该解释器的绝对路径。macOS/Linux 默认值是 `python3`，Windows 默认值是 `python`。在 Remote SSH 窗口中，应在 **远端 [SSH 主机]** 设置写入远端 Python 路径；本机和远端可以使用不同配置。随后从命令面板运行 **vivi: Check Python Backend**。若检查失败，查看 **vivi** Output 通道。

## 从开发版升级

0.6.1 起发布者从 `local-science` 改为 `Suzuka24`。`local-science.vivi` 与 `Suzuka24.vivi` 是两个独立的扩展 ID。在本机和需要使用的远端都安装新版，然后卸载旧版，避免出现两个 vivi Explorer 或编辑器注册冲突。`vivi.*` 设置键不变。安装或升级后重新加载编辑器窗口。

## 故障排查

- **看不到 vivi 图标或查看器：** 检查扩展是否安装并启用在正确的本机/远端，然后执行 **Developer: Reload Window**。
- **Python 进程退出或缺包：** 运行 **vivi: Check Python Backend**，确认 `vivi.pythonPath` 指向的解释器能够导入依赖，并查看 **vivi** Output 通道。
- **找不到远端路径：** 确认窗口已通过 Remote SSH 连接，而且 vivi 安装在该 SSH 主机。Explorer 中的路径属于扩展主机。
- **大图移动或切片切换较慢：** FITS/TIFF 通常按区域读取；PNG/JPEG 和视频可能需要完整解码。像素以原始 dtype 的字节传输，可用 `vivi.losslessCompression` 切换可逆压缩。`vivi.maxDecodedPixels` 仍保护需要完整解码的格式。
- **视频无法打开：** 远端 OpenCV 可能缺少对应的编解码器。可先测试支持的图像格式，或在该主机补齐编解码器。

报告可复现的问题时，请参阅 [SUPPORT.md](../SUPPORT.md)。

## 卸载

从每台安装过的主机卸载 `Suzuka24.vivi`。虚拟环境和用户数据文件仍留在主机上，如不再需要请自行移除。卸载扩展不会删除原始图像。
