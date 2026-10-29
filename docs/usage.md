# 使用指南

[English](usage.en.md) · [快捷键](shortcuts.md) · [加载与传输](loading-and-transport.md) · [ImageJ 菜单覆盖](imagej-menu-coverage.md)

## Explorer：浏览和管理文件

点击 vivi 活动栏图标后，Explorer 显示**扩展主机**上的目录。本地窗口读取本机路径；Remote SSH 窗口读取服务器路径。工具栏提供上级目录、主目录、刷新、新建目录、新建文件、删除、显示隐藏文件、向终端插入路径、排序和过滤。路径框可以选择最近访问目录；列表滚动到底部时继续读取后续条目。

文件名左侧使用与 Cursor/VS Code 接近的类型图标，vivi 可打开的图像使用独立的线框图标。最近打开的文件或最近进入的子目录会保留持久高亮，鼠标悬停使用另一种高亮；进入另一个项目后，高亮按各目录分别记忆。

Name、Size、Last modified 三列支持：

- 拖动分隔线调整宽度；
- 双击分隔线，按当前目录的**全部条目**计算完整显示所需的最小宽度；过宽的列也会收窄；
- 每个目录独立记忆三列宽度，重新进入时恢复；
- 文件名放不下时始终限制在 Name 列内并显示省略号。

Explorer 支持常用文件管理操作：

- `Shift+单击` 连续多选，`Ctrl/Command+单击` 切换选择；
- `Ctrl/Command+C`、`X`、`V` 复制、剪切、粘贴，`Delete` 永久删除；
- 把一个或多个选中条目拖到目录上表示移动；
- 鼠标中键单击把选中路径插入当前终端；
- `F2` 重命名，`Enter` 打开；
- **Remove Permanently…** 等价于递归删除文件或目录，执行前会确认。

## 打开图像和高维数据

双击 `vivi.managedExtensions` 中的文件，或在右键菜单选择 **Open**，会把文件作为 Frame 加入最近使用的 vivi 标签页。**Open in New Tab** 创建独立标签页。移出 `vivi.managedExtensions` 的后缀继续使用编辑器原有打开方式。

默认接管 PNG、TIFF、JPEG、BMP、FITS；支持的后缀匹配不区分大小写。具备对应 OpenCV codec 时还可读取 AVI、MP4、MOV、MKV。PNG/JPEG/BMP/GIF/视频通常需要整帧解码，受 `vivi.maxDecodedPixels` 保护；TIFF 和 FITS 通常可按区域或页面读取。

### Open As…

对三维及更高维单文件，右键 **Open As…** 会列出 TIFF 的每个 series 或 FITS 的每个 HDU，显示原始 shape、轴字母和目标 shape。目标表达式使用 rearrange 风格：

- 每个源轴字母必须恰好出现一次；
- 连接字母会合并维度，例如 `u v h w` 改为 `uv h w`；
- 通道通常放在末尾，如 `h w c`；把 `c` 移到 `h w` 前方，例如 `c h w`，会把通道作为灰度 stack slice；
- 非法表达式只显示错误，不关闭对话框，可继续修改。

普通 **Open** 保留自动识别行为。2D 图像直接打开；3D 数据使用一个 slice bar；更高维数据通过轴选择框切换由同一 slice bar 控制的轴。

### Open Folder as Stack…

该命令先选择：

- **Only 2D images**：忽略非 2D 图像；
- **All image planes**：把 2D 图和高维图的所有平面展开后合并。

随后可输入空格分隔的 `H W`。留空时，第一个合格图像定义目标高宽；之后尺寸不一致的文件会被跳过。列表按自然顺序处理，slice 状态栏显示源文件名和源文件中的平面编号。

### Header 与图像信息

**File → Header** 打开可移动、缩放、最小化、置顶和关闭的窗口。FITS 会显示每个 HDU 的完整 header；没有 header 的格式会给出明确提示。frame 会保留首次打开时的源 Header，因此原位处理生成临时 TIFF 后仍可查看，并标记为“源文件 Header”。当前仍有 flip/rotate 几何变换时会提示 WCS 可能不再对应；取消变换并恢复源几何后不再提示。**Image → Show Info…** 用于查看 vivi 识别的 shape、dtype、series/HDU 和相关元信息。

## Frame、Layout 与切片

Layout 管理当前 vivi 标签页中的 Frame。顶部的上、下按钮切换当前 Frame，显示模式按钮切换 Single/Tile；Frame 行可拖动排序，也可用上移、下移、置顶、置底按钮或快捷键排序。右键 Frame 可重命名、复制、调整顺序或关闭；复制品追加到列表末尾并使用 `[copy N]` 后缀。相同源标题自动添加 `(2)`、`(3)` 等后缀。重命名只改变显示标题，不改磁盘文件名。

眼睛图标决定 Frame 是否显示；锁图标决定是否参与同步。**All lock** 和 **Unlock** 只改变所有 Frame 的锁定参与状态，不修改后面的同步类别。可启用的同步组为：

- **B&C**：同步 Minimum、Maximum、Brightness、Contrast，并同时同步 LUT；
- **View**：同步视图中心与缩放；
- **Slice**：同步 slice 轴和位置；
- **Selection**：同步选区，也同步 Orthogonal Views 的十字线坐标。

Tile 模式中，可见且锁定的 Frame 会在同一交互过程中实时更新，包括拖动 slice bar、方向键、长按切片按钮、播放、B&C、LUT、平移、缩放、翻转、旋转和选区编辑。Layout 列表可用滚轮上下浏览。

第二行工具栏只在当前 Frame 有额外轴时显示。它包含 series/HDU、轴选择、slice bar、切片编号、播放和 FPS：

- 单击左右按钮只移动一帧；按住 300 ms 后才按 FPS 连续移动；
- 默认 FPS 为 24，可在当前查看器修改，也可通过 `vivi.defaultFps` 修改新查看器默认值；
- 默认滚轮上滚到前一 slice，下滚到后一 slice；
- 播放和长按到边界后的行为按当前控件状态处理。

加载中的 Frame 在 Layout 右侧显示旋转动画。HTTP 模式下点击 Frame 的关闭按钮会中止传输和后端请求；完成的 stack 在所有 slice 构建好后一次性显示。详见[加载与传输](loading-and-transport.md)。

## 工具栏、缩放和平移

工具栏包含 Rectangle、Oval、Polygon、Freehand、Line、Angle、Text、Magnifier、Hand、Pointer，以及 Montage、Orthogonal Views、Histogram、Measure、水平/垂直翻转和左右 90° 旋转。

- 新打开图像默认使用 Hand；`H` 选择 Hand，`P` 选择 Pointer，`G` 选择 Magnifier；
- `F` 执行 Fit，`1:1` 回到原始比例，缩放框可直接输入任意百分比；
- 缩放节点最高到 25600%；工具栏和键盘缩放以图像中心为中心，`Shift+滚轮` 以鼠标位置为中心；
- `Command+滚轮`（macOS）或 `Ctrl+滚轮`（Windows/Linux）以图像中心缩放；
- 放大后 `Space+滚轮` 上下平移，`Alt+滚轮` 左右平移，距离按 ImageJ 风格规则计算；
- 鼠标中键拖动也可平移；`Alt+鼠标右键拖动` 调整 B&C；
- 双击画面不再执行 Fit，避免与绘图和十字线操作冲突。

所有默认组合和修改方式见[快捷键与鼠标操作](shortcuts.md)。

## Adjust、Curve 与 LUT

Adjust 提供自动方法、Minimum、Maximum、Brightness、Contrast、Stretch、LUT、Invert，以及 Auto、Reset、S-Auto、S-Reset、Curve 五个操作。

- 同一 stack 的 Minimum/Maximum 和显示曲线保持共享；切换 slice 时不会自动改动显示窗口；
- Curve 的 histogram 和真实数据范围随当前 slice 更新，曲线按当前共享 B&C 绘制；
- **Auto** 根据当前 slice 计算；有面积选区时只使用选区像素。连续使用 Auto 会采用 ImageJ 风格的渐进增强；
- **Reset** 对 8-bit/RGB 恢复类型范围，对 16/32-bit 使用当前 slice 范围；面积选区按 ImageJ 规则处理；
- **S-Auto/S-Reset** 扫描当前三维 stack；高于三维时只使用当前所选 stack 轴；单张图时与 Auto/Reset 等价；
- Minimum/Maximum 可直接输入超出当前像素范围的值，滑块停在端点而曲线仍按输入值更新；
- Curve 窗口可开关、最小化，并随 B&C 操作实时重绘。

Stretch 是非破坏性显示映射：真实像素先用 Minimum/Maximum 归一化，再经过 Linear、Log、Exp、Sqrt、Square、Power、Asinh、Sinh、Abs 或 Histogram Equalization 等映射。Histogram、Measure、profile、像素读数和 Process 运算仍以真实像素为依据。Threshold 位于 **Image → Adjust**，只改变显示；**Process → Binary → Make Binary** 才会产生真实二值图像。

LUT 菜单合并 ImageJ、Fiji 和 vivi 的色表。常用编号项以 `000 Gray`、`001 MPL Plasma`、`002 Physics`、`003 Phase` 开头。翻转按钮和 Orthogonal Views 按钮使用高亮状态表示当前 Frame 的显示状态。

## Selection 与 Orthogonal Views

鼠标绘制选区吸附到整数像素；数值 Specify 对话框允许小数。状态栏按选区类型显示位置、宽高、面积、角度、长度等信息。Shift 约束包括：

- Rectangle/Oval 约束为正方形/圆；
- 新建或编辑 Line 端点时约束为水平、垂直或 45° 方向；
- Orthogonal Views 中按住 `Space` 使用当前工具，再叠加 `Shift` 时保留相同约束。

Smooth、Sharpen、Find Edges、滤镜和其他支持选区的 Process 操作只处理面积选区内像素。Line、Segmented Line 或 Freehand Line 可用于 Plot Profile 和 Reslice。Selection lock 会在兼容 Frame 间实时同步选区。

Orthogonal Views 支持 Single 和 Tile：XY 为主图，XZ 紧贴下方，YZ 紧贴右侧；三图十字线和 slice 位置实时同步。默认点击/拖动用于移动十字线；按住 `Space` 后才能使用当前工具。右键 XZ 或 YZ 可复制截面为独立 2D Frame。Orthogonal 状态按 Frame 保存，切换后再返回仍会恢复。

## 图像处理、分析与结果窗口

Image、Process、Analyze 的可运行项目和差异见[ImageJ 菜单覆盖情况](imagej-menu-coverage.md)。主要规则：

- 像素运算修改当前 Frame 的临时工作副本，不覆盖源文件；
- 尺寸兼容的 stack 操作保留所有 slice，几何变换处理整个 stack；
- Split Channels、Stack to Images 等天然多输出操作创建额外 Frame；
- 当前 Frame 的像素运算保留十步 Undo/Redo；默认 `Z` 只绑定 Undo，Redo 默认无快捷键；
- Flip/Rotate 属于 View 同步范围；任意角度 Rotate 提供 preview；处理期间显示状态提示；
- Montage 默认列数为 slice 数量平方根的四舍五入值；
- Reslice 使用当前 Line、Segmented Line 或 Freehand Line 路径；
- Skeletonize 需要适用的 8-bit 二值图，不满足时显示原因；
- 原尺寸 FFT 与 ImageJ 风格幂次尺寸 FFT 分开提供。

Histogram、Measure、Measure Stack、Statistics、Profile 等结果使用可移动窗口。窗口支持缩放、最小化、置顶和关闭；最小化后沿显示区下边缘排列。数值使用统一的紧凑格式。Profile 和 Z-axis Profile 图支持随窗口尺寸重排、坐标轴、网格、悬停读数、滚轮缩放、拖动平移和双击复位。

**Image → Copy Image** 和图像右键菜单中的 **Copy Image** 把当前可见画面复制到系统剪贴板，包含选区和叠加标记，效果接近直接截取图像显示区域。

## 设置

| 设置 | 默认值与用途 |
| --- | --- |
| `vivi.pythonPath` | 空；依次尝试旧版 `imageViewer.pythonPath` 和系统 `python3`/`python`。建议填写扩展主机上的绝对路径。 |
| `vivi.defaultPath` | `~`；Explorer 初始目录。 |
| `vivi.maxDecodedPixels` | `256000000`；保护必须整帧解码的 PNG/JPEG/BMP/GIF/视频。TIFF/FITS 通常走页面或区域读取。 |
| `vivi.requestTimeoutSeconds` | `120`；后端请求超时会停止 worker，重新打开图像后重启。 |
| `vivi.managedExtensions` | PNG/TIFF/JPEG/BMP/FITS 常用后缀；控制双击接管。 |
| `vivi.explorerContextMenu` | 所有一级、二级查看器菜单默认显示；可在设置或 **vivi: Configure Menu Visibility** 中逐项勾选。 |
| `vivi.transportMode` | `http`；可立即取消并能报告固定 payload 字节进度。`postMessage` 为兼容模式，已开始的单消息无法中止。 |
| `vivi.recentCacheSeconds` | `20`；本机内存中保留最近三张单幅图像 payload，过期或源文件变化即失效；`0` 关闭。 |
| `vivi.losslessCompression` | 开启；在可选有损编码后执行可逆压缩。 |
| `vivi.losslessMethod` | `zstd1-shuffle`；还可选 `zstd3-shuffle`、`zlib1-shuffle`。 |
| `vivi.lossyCompression` | 关闭；仅影响满足阈值的浮点预览，不修改源文件和服务端测量。 |
| `vivi.lossyMinFileMiB` | `128`；有损预览的源文件大小阈值。 |
| `vivi.lossyMethod` | `zfp`；还可选 float16、bfloat16 和 8/12/16 位分块量化。 |
| `vivi.lossyTolerance` | `0.0001`；ZFP 绝对误差目标占当前平面 min–max 范围的比例。 |
| `vivi.defaultFps` | `24`；播放和长按切片按钮速度，范围 1–60。 |
| `vivi.mouseShortcuts` | 可修改滚轮、缩放、平移、正交工具、Hand 和 B&C 手势。 |
| `vivi.keyboardShortcuts` | 131 个可配置动作；未绑定动作默认留空。组合格式与当前默认值见[快捷键文档](shortcuts.md)。 |

后端安装见[安装指南](installation.md)，传输流程见[加载与传输](loading-and-transport.md)，数据边界见[隐私说明](../PRIVACY.md)。
