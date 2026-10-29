# 默认快捷键与鼠标操作

[English](shortcuts.en.md) · [返回使用指南](usage.md)

## 修改方式

打开 VS Code/Cursor 设置，搜索 `vivi.keyboardShortcuts` 或 `vivi.mouseShortcuts`。键盘动作填写一个键，或使用 `+` 连接修饰键：

- 单键：`f`、`=`、`arrowleft`、`enter`、`f2`；
- 组合键：`shift+a`、`ctrl+arrowup`、`alt+m`、`cmd+p`；
- 修饰键支持 `shift`、`ctrl`、`alt`/`option`、`cmd`/`meta`；
- 动作填空字符串 `""` 表示禁用；
- 修饰键必须精确匹配，例如绑定 `shift+a` 后，单独按 `a` 不会触发该动作。

快捷键在 vivi 查看器及 Explorer/Layout/Adjust 获得焦点时生效。拖动 range slider 或原生滚动条后仍然有效；在文本框、数值输入框或下拉框内编辑时会暂停，避免按键被误当成图像命令。设置修改后，工具提示会立即更新。

`vivi.keyboardShortcuts` 列出了所有可配置的菜单和工具动作，共 131 项。下表只列当前有默认绑定的动作；其他动作默认留空，由用户自行分配。

## 图像工具与视图

| 动作 | 设置键 | 默认键 |
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

Redo (`redoTransform`) 默认不绑定。Polygon、Freehand、Angle、Text、1:1、Curve 开关和多数菜单命令也默认留空。

## Slice、Frame 与 Layout

| 动作 | 设置键 | 默认键 |
| --- | --- | --- |
| 播放/暂停 slice | `play` | `Enter` |
| 前一 slice | `previousSlice` | `Arrow Left` |
| 后一 slice | `nextSlice` | `Arrow Right` |
| 前一 Frame | `previousFrame` | `Arrow Up` |
| 后一 Frame | `nextFrame` | `Arrow Down` |
| Frame 上移一位 | `moveFrameUp` | `Shift+Arrow Up` |
| Frame 下移一位 | `moveFrameDown` | `Shift+Arrow Down` |
| Frame 移到顶部 | `moveFrameFirst` | `Ctrl+Arrow Up` |
| Frame 移到底部 | `moveFrameLast` | `Ctrl+Arrow Down` |
| Single/Tile 切换 | `toggleFrameDisplay` | `D` |
| 重命名当前 Frame/Explorer 条目 | `rename` | `F2` |

方向键切 slice 与工具栏按钮一致；持续按住切片按钮按当前 FPS 播放，而键盘按键由操作系统的 key repeat 控制。

## Adjust

| 动作 | 设置键 | 默认键 |
| --- | --- | --- |
| 当前 slice Auto | `autoCuts` | `A` |
| 当前 slice Reset | `resetCuts` | `S` |
| 当前 stack S-Auto | `stackAutoCuts` | `Shift+A` |
| 当前 stack S-Reset | `stackResetCuts` | `Shift+S` |

Auto/Reset 在有面积选区时使用当前 slice 的选区像素；S-Auto/S-Reset 使用当前三维 stack，并在每个 slice 上应用相同结果。

## 默认鼠标手势

这些值位于 `vivi.mouseShortcuts`。`mod` 在 macOS 代表 Command，在 Windows/Linux 代表 Ctrl。

| 动作 | 设置键 | 默认手势 |
| --- | --- | --- |
| 切换 slice | `slice` | `wheel`：上滚到前一 slice，下滚到后一 slice |
| 以鼠标为中心缩放 | `zoomAtPointer` | `shift+wheel` |
| 以图像中心缩放 | `zoomAtCenter` | `mod+wheel` |
| 垂直平移放大后的图像 | `verticalPan` | `space+wheel` |
| 水平平移放大后的图像 | `horizontalPan` | `alt+wheel` |
| Orthogonal Views 中使用当前工具 | `orthogonalTool` | `space+click` 或拖动 |
| Hand 平移 | `handDrag` | `middle+drag` |
| 调节 Brightness/Contrast | `contrastDrag` | `alt+right+drag` |

把某个鼠标手势设为空字符串可禁用。不要给多个动作设置完全相同的手势，否则先匹配的动作会取得事件。

## 绘图时的修饰键

- `Shift`：Rectangle/Oval 约束为正方形/圆；Line 新建和端点编辑约束到水平、垂直或 45°。
- Orthogonal Views 中，普通左键用于移动十字线；按住 `Space` 才使用当前工具。`Space+Shift+拖动` 会同时保留上述 Shift 约束。
- `Alt+鼠标右键拖动` 用于 B&C，不触发图像右键菜单；短右键仍打开菜单。

## Explorer 的固定操作

这些是 Explorer 的文件管理交互，不属于 `vivi.keyboardShortcuts` 对象：

| 操作 | 默认输入 |
| --- | --- |
| 连续多选 | `Shift+单击` |
| 切换多选 | `Ctrl+单击` / macOS `Command+单击` |
| 复制、剪切、粘贴 | `Ctrl/Command+C`、`X`、`V` |
| 永久删除 | `Delete` |
| 打开 | `Enter` 或双击 |
| 重命名 | `F2` |
| 移动条目 | 拖动选中条目到目标目录 |
| 插入终端路径 | 鼠标中键单击 |
| 列宽自适应 | 双击 Name、Size 或 Last modified 右侧分隔线 |
