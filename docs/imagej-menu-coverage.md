# ImageJ 菜单覆盖情况（vivi 0.5.5）

此表仅记录 vivi 当前显示的 File / Edit / Image / Process / Analyze 菜单。`Planned` 项尚未执行任何处理。图像计算在扩展运行的主机完成，衍生结果创建新的 Frame；原图仍以只读方式打开。

| 菜单 | 已可使用 | 尚未实现 |
| --- | --- | --- |
| File | Open、Close Frame、导出预览 PNG、导出结果 CSV | New Image/Stack/Text Window、Open Recent、Import Image Sequence/Raw/URL、Save As TIFF/FITS、Revert、Print |
| Edit | Clear Selection、Selection: Select All/Select None/Restore Selection/Enlarge/Fit Spline/Properties/Specify/Add to Overlay/Add to ROI Manager | Undo、Redo、Cut、Copy、Paste、Options: Colors/Line Width/Memory & Threads |
| Image | Adjust: Brightness/Contrast、Auto、Reset、Threshold；Stacks: Make Montage、Z Project；Transform: Flip Horizontally/Vertically；Crop、Duplicate、Rename | Type: 8/16/32-bit/RGB；Color: Channels Tool/Split/Merge；Stacks: Add/Delete Slice、Orthogonal Views；Transform: Rotate；Properties |
| Process | Enhance Contrast: Auto、Normalize；Math: Add/Subtract/Multiply/Divide；Filters: Gaussian Blur/Median/Unsharp Mask | 其他 ImageJ Process 命令（如 FFT、Binary、Batch）尚未列入菜单 |
| Analyze | Measure、Histogram、Plot Profile、ROI Manager | Set Measurements、Set Scale、Analyze Particles、Calibration Bar |

ImageJ 自身还有较多尚未列入 vivi 菜单的类别：Image 的 Hyperstacks、Zoom、Overlay、Lookup Tables；Process 的 Noise、Shadows、Binary、FFT、Batch 和 Image Calculator；Analyze 的 Gels、Summarize、Clear Results 及更多 Tools。具体条目会随 ImageJ 版本与安装的插件变化；本清单以 ImageJ 官方 [Menus.java](https://github.com/imagej/ImageJ/blob/master/ij/Menus.java) 的菜单结构为参考。

## 目前与 ImageJ 的差异

- Duplicate 对 2D 图像提供标题；对 stack 提供 Duplicate stack 和 `起始-结束` 范围；有面积选区时提供 Ignore selection。它在主机上保存真实像素副本。普通 stack 的范围按 ImageJ 的线性切片序号处理。多轴 hyperstack 目前将 C/Z/T 展平为线性切片序号，尚未提供各轴单独范围。ImageJ 的行为参考其 [Duplicator.java](https://github.com/imagej/ImageJ/blob/master/ij/plugin/Duplicator.java)。
- Gaussian Blur 与 Unsharp Mask 接受 0–20 px 的 sigma。Median 当前支持半径 1 或 2 px。处理当前切片并生成新 Frame；尚未提供 ImageJ 的“处理整个 stack”对话框。
- Z Project 当前支持全 stack 的最大、平均和最小投影，最多 256 切片；尚未提供区间和其他投影方式。
- 图像变换与四则运算目前作用于当前切片并创建新 Frame，尚未实现对源 Frame 像素的就地修改及其 Undo/Redo。
- Threshold 是显示用二值映射，不修改原始像素：Min ≤ 像素值 ≤ Max 显示白色，其他值显示黑色。勾选后使用 Manual 色阶；通过 Adjust 中的 Min/Max 设置上下阈值。
- 缩放档位取自 ImageJ 的 [ImageCanvas.java](https://github.com/imagej/ImageJ/blob/master/ij/gui/ImageCanvas.java)。Fit 仍按窗口大小计算，故可以落在这些固定档位之间。
