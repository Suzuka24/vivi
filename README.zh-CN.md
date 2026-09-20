# vivi

[English](README.md) · [安装指南](docs/installation.md) · [使用指南](docs/usage.md) · [ImageJ 菜单覆盖情况](docs/imagej-menu-coverage.md)

vivi 是面向 VS Code 和 Cursor 的科学图像与数据查看扩展。它在扩展运行的主机上浏览和读取文件。通过 Remote SSH 连接服务器时，Python 在服务器上解码、处理图像，编辑器只接收预览和结果，无需先把原始大文件下载到本机。

## 主要功能

- 打开 PNG、JPEG、TIFF、FITS 等图像；浏览 TIFF stack、hyperstack 和 FITS 的多个 HDU。也可将图像文件夹导入为按自然顺序排列的 stack，并在切换 slice 时查看源文件名。具备相应解码器时，还可预览 AVI、MP4、MOV、MKV 视频。
- 用 vivi Explorer 访问当前主机上任何有权限的路径，包括工作区以外的路径。通过 `vivi.managedExtensions` 选择哪些扩展名交由 vivi 双击打开；其他文件使用编辑器原有方式。
- 在一个编辑器标签页中管理多个 Frame，可切换、平铺、排序，并选择哪些 Frame 参与显示参数同步。同名 Frame 自动编号；在 Layout 中右键 Rename 可修改显示标题，不会更改源文件。**Open in New Tab** 会打开独立标签页。
- 调整亮度与对比度、拉伸、阈值和 LUT；绘制与测量选区；查看像素值和直方图。ImageJ 风格的菜单包含 stack 转换、montage、reslice、投影、剖面及部分图像处理命令。
- 缓存图像预览以改善浏览流畅度。缓存上限可配置；超过上限的图像在导航时仍可能需要服务器读取。

**vivi 仍在开发中。** 灰色菜单项尚不可用，部分同名命令的行为也比 ImageJ 简化。进行分析前请查看[功能覆盖和差异说明](docs/imagej-menu-coverage.md)。

## 快速安装

需要桌面版或 Remote SSH 的 VS Code/Cursor 扩展主机、Python 3.10+，以及在**读取图像的那台主机**上安装的 [`backend/requirements.txt`](backend/requirements.txt) 依赖。vivi 不会自动安装 Python 包。

1. 上架后可从扩展商店安装；目前也可以从仓库构建 VSIX，再通过 **扩展 → … → 从 VSIX 安装** 安装。
2. 在扩展主机上安装 Python 依赖：

   ```bash
   python3 -m venv ~/.venvs/vivi
   ~/.venvs/vivi/bin/python -m pip install -r backend/requirements.txt
   ```

   如果只安装了 VSIX，请另外下载 [`backend/requirements.txt`](backend/requirements.txt)，或在主机上克隆本仓库。Windows 请使用虚拟环境中的 `python.exe`。

3. 在相应的本机或远端设置中，将 `vivi.pythonPath` 设为该 Python 的**绝对路径**，然后在命令面板运行 **vivi: Check Python Backend**。
4. 点击 vivi 活动栏图标，进入目录并双击图像。使用 Remote SSH 时，还需在**远端扩展主机**安装 vivi，并在远端完成 Python 配置。

从开发版升级：0.6.1 起发布者从 `local-science` 改为 `Suzuka24`。`local-science.vivi` 与 `Suzuka24.vivi` 是两个不同的插件 ID；安装新版后请卸载旧版。`vivi.*` 设置键保持不变。

详见[安装、升级与故障排查](docs/installation.md)。

## 文档

- [安装与 Remote SSH](docs/installation.md) · [English](docs/installation.en.md)
- [查看器与 Explorer 使用指南](docs/usage.md) · [English](docs/usage.en.md)
- [ImageJ 菜单覆盖及差异](docs/imagej-menu-coverage.md)
- [隐私与本地数据](PRIVACY.md)、[问题反馈](SUPPORT.md)、[安全报告](SECURITY.md)
- [参与贡献](CONTRIBUTING.md)、[发布流程](PUBLISHING.md)、[版本记录](changelog.md)

## 许可

[MIT](LICENSE)。vivi 是独立项目，与 ImageJ/Fiji、SAOImage DS9、VS Code 或 Cursor 的开发团队没有隶属或背书关系；相关名称属于各自权利人。
