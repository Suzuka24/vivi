# 使用指南

## 浏览和打开文件

点击 vivi 活动栏图标，输入**扩展主机**上的目录。Remote SSH 窗口中的路径属于服务器。工具栏提供上级目录、主目录、刷新、新建、删除、显示隐藏文件、复制路径到终端和排序；路径框可选择历史目录。向下滚动可继续加载文件，过滤框作用于已加载的列表。

双击由 vivi 接管的图像，或选择 **Open**，会把它作为 Frame 加入最近使用的 vivi 编辑器标签页。**Open in New Tab** 会在当前编辑器组中新建独立标签页。通过 `vivi.managedExtensions` 选择由 vivi 接管的后缀；移出列表的文件使用编辑器原来的打开方式。命令面板运行 **vivi: Configure Menu Visibility**，勾选或取消图像视图一级、二级菜单项；默认全选。

**Open Folder as Stack** 会询问读取模式：**Only 2D images** 跳过非 2D 文件，**All image planes** 将 2D 和 3D 文件的切片依次合并。右下角显示切片的源文件名及原文件中的编号。文件须具有相同的宽、高、数据类型和通道数。Explorer 的 **Remove** 会递归永久删除目标，操作前弹出确认。

## Frame 与切片

侧栏的 **Layout** 管理文件 Frame。新标签页默认显示单个 Frame。点击显示模式图标可切换平铺；拖动 Frame 行可排序，并可设置行数或列数。眼睛开关决定是否显示，旁边的锁开关决定是否参与参数同步。修改参数前先选中对应 Frame；平铺时方向键可在可见 Frame 间移动选中状态。只有参与锁定的 Frame 才同步 B&C、LUT、视野、缩放或切片。新加入锁定组的 Frame 会继承已启用的同步设置。

Layout 中右键 Frame 可重命名、复制或关闭。复制品添加到列表末尾，标题附加 `[copy N]`。Frame 列表支持滚轮滚动。

第二行工具栏提供 series、切片进度条、切片编号、播放和 FPS。左右按钮单击跳一帧，按住则按设定帧率连续切换；拖动进度条可直接跳到目标切片。FITS 可能有多个 HDU，TIFF 可能有多个 series。某些 TIFF 的轴约定无法完全自动推断，使用时请核对显示的 series 和 shape。

## 显示与测量

**Adjust** 包含自动调整方法、Min/Max 输入与滑块、Brightness/Contrast 滑块、stretch、LUT、invert 和可开关的 Curve 显示曲线。这些显示参数属于当前 Frame，切换该 Frame 的 slice 时保持不变，也不会改写原始像素。Threshold 可从 Image → Adjust 菜单设置；它会把原始值位于 Min 与 Max 之间的像素显示为白色，其余显示为黑色。Layout 的 All lock/Unlock 只勾选或取消所有 Frame 的锁定参与状态，不修改 B&C、LUT、View、Zoom、Slice 的选择。

查看器工具栏包含 ImageJ 风格的选区、画图、放大镜、pan 和 pointer，也提供 montage、正交视图、直方图、测量与常用翻转/旋转入口。鼠标画出的选区吸附到整数像素；数值选区对话框允许小数坐标。底部显示像素位置与数值。正交视图只在单 Frame stack 模式下启用；拖动任一十字线可同步三个截面，右键 XZ 或 YZ 可复制该截面为 2D Frame。通过 **Analyze → Histogram** 先设置 bins 与范围，再打开可拖动的结果窗口查看样本数和统计信息。部分 ImageJ 命令仍未开放或采用简化行为，详见[菜单覆盖情况](imagej-menu-coverage.md)。

## 生成的结果

Duplicate、Crop、Montage、投影及多项 Process 命令会创建新 Frame。Montage 将原始灰度值写为 TIFF 像素；**Scale (%)** 改变每个拼块的像素尺寸。正交翻转和旋转则替换当前 Frame 的显示内容，最多可撤销或重做十步。磁盘上的源文件不变；生成的图像暂存在扩展主机，可通过相应的 File 命令导出。

## 常用设置

| 设置 | 用途 |
| --- | --- |
| `vivi.pythonPath` | 扩展主机上的 Python 解释器绝对路径。 |
| `vivi.defaultPath` | Explorer 的初始主机目录。 |
| `vivi.managedExtensions` | 双击时由 vivi 接管的文件后缀。 |
| `vivi.explorerContextMenu` | 图像视图一级、二级菜单的显隐勾选；默认全部显示，包括待实现的灰色命令。也可运行 **vivi: Configure Menu Visibility**。 |
| `vivi.losslessCompression` | 默认开启，原始 dtype 的像素字节经可逆重排和 zlib 压缩后传输；关闭则直接传原始字节。压缩无收益时会自动使用原始字节。 |
| `vivi.lossyCompression` | 默认关闭。开启后仅对超过阈值的浮点图像预览进行有损编码；源文件、服务端测量和导出数据保持原值。 |
| `vivi.lossyMinFileMiB` | 有损编码的源文件大小阈值，默认 128 MiB；只有严格大于阈值的文件才启用。 |
| `vivi.lossyMethod` | 默认 ZFP，也可选 float16、bfloat16 或 64×64 分块的 8/12/16 位量化。整数图像和非有限值帧保留原始字节。 |
| `vivi.lossyTolerance` | ZFP 绝对误差目标占当前预览帧最大值与最小值之差的比例，默认 0.0001；其他方法不使用该设置。 |
| `vivi.keyboardShortcuts` | 按动作配置快捷键；组合键写成 `shift+p`、`ctrl+shift+h` 等，macOS Command 写成 `cmd`。默认 `=` / `-` 缩放、左右方向键切换切片、上下方向键切换 Frame、`m` 切换 Single/Tile、`shift+p` 选 Pointer。空字符串表示禁用。仅在图像视图获得焦点且没有输入框获得焦点时生效。 |

后端配置见[安装指南](installation.md)，主机数据存储与传输见[隐私说明](../PRIVACY.md)。

当前帧显示后，vivi 从当前帧向两侧立即预载全部 stack 切片，并为每帧生成可直接显示的画面；状态中的“ready”表示该帧已完成解码和着色。不设预览尺寸或缓存内存预算。**Image → Copy Image** 和图像右键菜单中的 **Copy Image** 复制当前画面里可见的图像区域，包含画面上的选区及叠加标记。

有损与无损开关独立：符合条件时先做有损编码，再按无损开关决定是否对编码字节进行可逆压缩；接收端按相反次序解码。有损开启后，画面上的像素值读数来自近似预览数据；需要精确数值时请关闭有损开关。当前版本对源文件大小而非整个 stack 的内存大小判断阈值。SZ3 在参考 TIFF 的基准中压缩率更高，但尚无本预览窗口可使用的浏览器解码链路，因此暂未列入可选方法。详见[目标 TIFF 基准结果](../worklog/2026-09-20/203247_lossy-preview-compression.md)。
