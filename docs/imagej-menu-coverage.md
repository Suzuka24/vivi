# ImageJ 菜单覆盖情况（vivi 0.7.0）

此清单以 ImageJ 1.x 源码中的 `ij/plugin`、`ij/plugin/filter` 和 `ij/process` 实现为参照。开发时可把官方源码检出到不会提交和打包的 `ref/ImageJ`。可运行命令与 ImageJ 同名，但仅在下述范围内实现；灰色命令不执行操作。源文件始终只读，像素运算替换当前 vivi Frame 的工作副本，可撤销十步。

| 菜单 | 已可运行 | 尚未实现或尚不等价 |
| --- | --- | --- |
| Image | Type: 8/16/32-bit、RGB；Adjust；Show Info；Color: Split/Merge Channels、Channels Tool、Stack to RGB、Make Composite、LUT；Stacks: Images to Stack、Stack to Images、Montage、Reslice、Orthogonal Views、Z Projection、Z-axis Profile、Measure Stack、Statistics；Crop、Copy、Duplicate、Rename、Scale；Transform: 翻转、90°/180°和任意角度旋转；Zoom；Overlay: Add Selection | 8-bit Color、HSB Stack、Stack 增删与重排、Overlay Flatten/导出、Properties |
| Process | Smooth、Sharpen、Find Edges；Find Maxima 的局部峰值结果；Auto/Normalize/Equalize；Gaussian/Salt and Pepper/Despeckle/Remove Outliers；Shadows；Binary 二值化、腐蚀、膨胀、开、闭、填洞、Watershed、Skeletonize；Math；原尺寸 FFT、ImageJ 幂次尺寸 FFT 和 Bandpass；Gaussian/Median/Unsharp/Mean/Min/Max/Variance/Convolve | Find Maxima 的全部输出模式、ImageJ FFT 所附带复数变换数据及 Inverse FFT、批处理与部分高级参数 |
| Analyze | Measure、Summarize、Distribution、Label、Clear Results、Set Measurements、Set Scale、Histogram、Plot Profile、Skeleton、ROI Manager | Analyze Particles、更多测量字段、校准条及 ROI Manager 全部操作 |
| File/Edit | Open/Open As、文件夹序列、Close Frame、PNG/CSV 导出、Copy Image；选区创建与编辑；所有当前 Frame 像素运算的十步 Undo/Redo | New、Raw/URL Import、原格式覆盖保存、Print、Cut/Paste、完整 Edit Options |

## 关键行为与限制

- B&C 在 Frame 首次呈现时由所选自动方式计算，然后把该 Frame 的 Min/Max 固定。切片切换沿用这组数值；只有在 Adjust 中再次选择自动方式或手动修改才变化。
- Layout 的第一列勾选控制显示，第二列勾选控制是否参与参数锁。刚加入锁定组的 Frame 从已勾选的 Frame 继承当前勾选的参数组。退出锁定组后保留自己的参数。
- Duplicate 对 2D 图像提供标题；对 stack 提供 Duplicate stack 与切片范围；面积选区可裁切或忽略。多轴 hyperstack 暂时用线性切片序号表示范围。
- Montage 按 Scale (%) 缩放每张切片，再按指定列数排布；灰度输出保持原始 dtype，比例为 100% 时保持原始数值。翻转与正交旋转替换当前 Frame 的显示内容并保留其 stack 切片，源文件不写回磁盘。最多记录十次撤销。
- ImageJ 核心内置 LUT 之外，vivi 还合并了 [ImageJ 官方 LUT 归档](https://imagej.net/ij/download/luts/luts.zip)、ImageJ 1.54 发行包和 [Fiji LUT 目录](https://github.com/fiji/fiji/tree/main/luts)，按名称去重后包含 89 个原始色表，其中包括 Physics。来源与转换方式见 [`backend/IMAGEJ_LUTS.md`](../backend/IMAGEJ_LUTS.md)。归档中只用于排序的 `000-` 至 `005-` 前缀不会显示。
- 图像处理操作默认修改当前 Frame 的工作副本，不写回源文件；stack 中尺寸兼容的操作保留其余 slice，几何操作处理整个 stack。Split Channels、Stack to Images 等多输出命令仍会创建 Frame。
- Smooth、Sharpen、Find Edges 的核或算子按 ImageJ 1.x 实现选择；OpenCV/NumPy 的边界处理和浮点舍入可能造成边缘像素不逐位一致。Inverse FFT 仍标灰，因为 TIFF 工作副本无法携带 ImageJ `FHT` 的复数变换属性。
- Threshold 在显示层将 Min 到 Max 之间的原始像素显示为白色，范围外为黑色。Process → Binary → Make Binary 则创建真实二值图像。
