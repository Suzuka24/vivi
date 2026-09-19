# 使用指南

## 浏览和打开文件

点击 vivi 活动栏图标，输入**扩展主机**上的目录。Remote SSH 窗口中的路径属于服务器。工具栏提供上级目录、主目录、刷新、新建、删除、显示隐藏文件、复制路径到终端和排序；路径框可选择历史目录。向下滚动可继续加载文件，过滤框作用于已加载的列表。

双击由 vivi 接管的图像，或选择 **Open**，会把它作为 Frame 加入最近使用的 vivi 编辑器标签页。**Open in New Tab** 会在当前编辑器组中新建独立标签页。通过 `vivi.managedExtensions` 选择由 vivi 接管的后缀；移出列表的文件使用编辑器原来的打开方式。`vivi.explorerContextMenu` 可决定右键菜单显示哪些项目及其顺序。

## Frame 与切片

侧栏的 **Layout** 管理文件 Frame。新标签页默认显示单个 Frame。点击显示模式图标可切换平铺；拖动 Frame 行可排序，并可设置行数或列数。眼睛开关决定是否显示，旁边的锁开关决定是否参与参数同步。修改参数前先选中对应 Frame；平铺时方向键可在可见 Frame 间移动选中状态。只有参与锁定的 Frame 才同步 B&C、LUT、视野、缩放或切片。新加入锁定组的 Frame 会继承已启用的同步设置。

第二行工具栏提供 series、切片进度条、切片编号、播放和 FPS。左右按钮单击跳一帧，按住则按设定帧率连续切换；拖动进度条可直接跳到目标切片。FITS 可能有多个 HDU，TIFF 可能有多个 series。某些 TIFF 的轴约定无法完全自动推断，使用时请核对显示的 series 和 shape。

## 显示与测量

**Adjust** 包含自动调整方法、Min/Max 输入与滑块、Brightness/Contrast 滑块、stretch、LUT、invert、threshold 和显示曲线。这些显示参数属于当前 Frame，切换该 Frame 的 slice 时保持不变，也不会改写原始像素。Threshold 会把原始值位于 Min 与 Max 之间的像素显示为白色，其余显示为黑色。

查看器工具栏包含 ImageJ 风格的选区、画图、放大镜、pan 和 pointer。鼠标画出的选区吸附到整数像素；数值选区对话框允许小数坐标。底部显示像素位置与数值。通过 **Analyze → Histogram** 先设置 bins 与范围，再打开可拖动的结果窗口查看样本数和统计信息。部分 ImageJ 命令仍未开放或采用简化行为，详见[菜单覆盖情况](imagej-menu-coverage.md)。

## 生成的结果

Duplicate、Crop、Montage、投影及多项 Process 命令会创建新 Frame。Montage 将原始灰度值写为 TIFF 像素；**Scale (%)** 改变每个拼块的像素尺寸。正交翻转和旋转则替换当前 Frame 的显示内容，最多可撤销或重做十步。磁盘上的源文件不变；生成的图像暂存在扩展主机，可通过相应的 File 命令导出。

## 常用设置

| 设置 | 用途 |
| --- | --- |
| `vivi.pythonPath` | 扩展主机上的 Python 解释器绝对路径。 |
| `vivi.defaultPath` | Explorer 的初始主机目录。 |
| `vivi.managedExtensions` | 双击时由 vivi 接管的文件后缀。 |
| `vivi.explorerContextMenu` | Explorer 右键菜单项目与顺序。 |
| `vivi.preloadMaxMiB` | stack 解码预览缓存的大致上限。 |
| `vivi.maxPreviewSize` | 传输预览的最大边长。 |
| `vivi.keyboardShortcuts` | 按动作配置的单键快捷键，在 `settings.json` 编辑。 |

后端配置见[安装指南](installation.md)，主机数据存储与传输见[隐私说明](../PRIVACY.md)。
