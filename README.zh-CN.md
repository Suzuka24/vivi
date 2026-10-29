# vivi

[English](README.md) · [安装指南](docs/installation.md) · [使用指南](docs/usage.md) · [快捷键](docs/shortcuts.md) · [加载与传输](docs/loading-and-transport.md) · [ImageJ 菜单覆盖情况](docs/imagej-menu-coverage.md)

vivi 是面向 VS Code 和 Cursor 的科学图像与数据查看扩展。它在扩展运行的主机上浏览、读取和处理文件。通过 Remote SSH 连接服务器时，Python 在服务器上解码图像，编辑器只接收显示所需的像素与分析结果，无需先把原始大文件下载到本机。

## 主要功能

- **科学图像与高维数据：**直接打开 PNG、JPEG、BMP、TIFF、FITS 等格式，浏览 TIFF stack、hyperstack、多个 series 和 FITS 多 HDU。**Open As…** 显示原始 shape，并接受 `uv h w`、`c h w` 形式的轴重排。**Open Folder as Stack…** 可只读取 2D 图像或展开全部图像平面，并按统一 `H W` 过滤。具备对应 OpenCV codec 时也可预览 AVI、MP4、MOV 和 MKV。
- **主机文件 Explorer：**访问本地或 Remote SSH 主机上任何有权限的路径。支持多选、复制、剪切、粘贴、递归删除、拖动移动、终端路径插入、隐藏文件、排序和过滤。Name、Size、Last modified 三列可拖动、双击自适应，并按目录记忆宽度；最近打开的文件或进入的子目录会保留独立高亮。
- **Frame、stack 与平铺同步：**在一个编辑器标签页中管理多个 Frame，支持 Single/Tile、排序、复制、重命名和关闭。可对锁定 Frame 实时同步 B&C 与 LUT、View 与 Zoom、Slice、Selection；Tile 和 Orthogonal Views 中同样适用。切片支持滚轮、滑块、方向键、长按和 FPS 播放。
- **ImageJ 风格显示与交互：**提供 Rectangle、Oval、Line、Polygon、Freehand、Angle、Text、Magnifier、Hand 和 Pointer 等工具；支持可输入缩放比例、最高 25600% 的缩放节点、以指针或图像中心缩放，以及水平/垂直平移。正交视图在 XY、XZ、YZ 间同步十字线，并可将 XZ/YZ 截面复制成 2D Frame。
- **B&C、LUT 与选区：**Minimum/Maximum 对整个 stack 共享，Curve 的 histogram 随当前 slice 更新。Auto/Reset 可按当前帧或面积选区计算，S-Auto/S-Reset 按当前三维 stack 计算。Stretch 只改变显示映射；处理、测量和像素读数仍使用真实像素。选区可参与测量、profile、reslice 和局部图像处理。
- **处理与分析：**Image、Process、Analyze 菜单提供类型转换、颜色通道、montage、reslice、投影、翻转/旋转、滤波、二值形态学、Math、FFT、Histogram、Measure、Statistics、Plot Profile、Z-axis Profile、Skeleton 和 ROI Manager 等功能。像素运算默认替换当前 Frame 的工作副本，可撤销十步；源文件不会被写回。FITS 可通过 **File → Header** 查看所有 HDU header。
- **大文件加载与传输：**默认通过可取消的 HTTP 连续流传输；stack 使用单次连续响应、背压和浏览器双缓冲，全部 slice 构建完成后统一显示。预览保持源 dtype；无损默认采用 Zstandard level 1 + Byte Shuffle，有损预览可独立开启。最近三张单幅图像 payload 可在内存中短暂复用，源文件发生变化时不会误用缓存。加载完成后立即释放源文件句柄。
- **可配置操作：**键盘与鼠标手势都可在设置中修改。默认快捷键、组合键格式和 Explorer 操作见[快捷键与鼠标操作](docs/shortcuts.md)。菜单一级、二级项目也可按需隐藏。

**vivi 仍在开发中。** 灰色菜单项尚不可用，部分同名命令的参数或输出仍比 ImageJ 简化。进行分析前请查看[功能覆盖和差异说明](docs/imagej-menu-coverage.md)。

## 快速安装

需要桌面版 VS Code/Cursor、Python 3.10+，以及在**实际读取图像的扩展主机**上安装的 [`backend/requirements.txt`](backend/requirements.txt) 依赖。vivi 不会自动安装 Python 包。

1. 上架后可从扩展商店安装；目前也可以克隆仓库并运行 `pnpm install`、`pnpm run package`，再通过 **扩展 → … → 从 VSIX 安装** 安装。
2. 在本地或 Remote SSH 主机创建 Python 环境并安装依赖：

   ```bash
   python3 -m venv ~/.venvs/vivi
   ~/.venvs/vivi/bin/python -m pip install -r backend/requirements.txt
   ```

3. 在对应的**用户、本地、远程或工作区设置作用域**中，将 `vivi.pythonPath` 设为该 Python 的绝对路径，然后运行命令面板中的 **vivi: Check Python Backend**。
4. 点击 vivi 活动栏图标，进入目录并双击图像。Remote SSH 窗口需要把 vivi 和 Python 依赖都安装在远端扩展主机。

从开发版升级：0.6.1 起发布者从 `local-science` 改为 `Suzuka24`。两者是不同插件 ID；安装新版后请卸载旧版。详见[安装、升级与故障排查](docs/installation.md)。

## 文档

- [安装、Python 环境与 Remote SSH](docs/installation.md) · [English](docs/installation.en.md)
- [查看器、Explorer 与分析功能](docs/usage.md) · [English](docs/usage.en.md)
- [默认快捷键与鼠标操作](docs/shortcuts.md) · [English](docs/shortcuts.en.md)
- [大文件加载、压缩、传输与缓存](docs/loading-and-transport.md) · [English](docs/loading-and-transport.en.md)
- [ImageJ 菜单覆盖及差异](docs/imagej-menu-coverage.md)
- [隐私与本地数据](PRIVACY.md)、[问题反馈](SUPPORT.md)、[安全报告](SECURITY.md)
- [参与贡献](CONTRIBUTING.md)、[发布流程](PUBLISHING.md)、[版本记录](changelog.md)

## 许可

[MIT](LICENSE)。vivi 是独立项目，与 ImageJ/Fiji、SAOImage DS9、VS Code 或 Cursor 的开发团队没有隶属或背书关系；相关名称属于各自权利人。
