# ImageJ 菜单覆盖情况（vivi 0.6.0）

此清单以 [ImageJ Image](https://imagej.net/ij/docs/menus/image.html)、[Process](https://imagej.net/ij/docs/menus/process.html)、[Analyze](https://imagej.net/ij/docs/menus/analyze) 菜单为参照。可运行的命令与 ImageJ 同名，但仅在下述范围内实现；灰色命令不执行操作。源数据按只读方式打开，新的图像结果作为新的 vivi Frame。

| 菜单 | 已可运行 | 尚未实现或尚不等价 |
| --- | --- | --- |
| Image | Type: 8/16/32-bit、RGB；Adjust: Auto、ZScale、百分位、手动 B&C、四组滑块、Threshold；Show Info；Color: Split Channels、LUT 预览；Stacks: Images to Stack、Stack to Images、Montage、Reslice、Z Projection、Z-axis Profile、Measure Stack、Statistics；Crop、Duplicate、Rename、Scale；Transform: 水平/垂直翻转、90°/180°旋转；Zoom: In/Out/Original/Fit；Overlay: Add Selection | 8-bit Color、Color 的 Merge Channels/Composite 和完整 Channels Tool、Stack 增删与重排、任意角度旋转/平移、Overlay 隐藏/显示/Flatten/导出、Hyperstack 各轴范围处理 |
| Process | Smooth、Sharpen、Find Edges；Find Maxima 的基本局部峰值；Enhance Contrast 的 Auto/Normalize/Equalize；Noise 的 Gaussian/Salt and Pepper/Despeckle；Shadows 四向；Binary 的二值化、腐蚀、膨胀、开、闭、填洞、形态骨架；Math 的四则运算、Invert/Sqrt/Square/Log/Exp/Abs；FFT 原尺寸及 ImageJ 2 的幂补齐功率谱与基本高通；Filters 的 Gaussian/Median/Unsharp/Mean/Min/Max/Variance | Find Maxima 的全部输出模式与精确 ImageJ 容差、完整 Noise/Shadows/Binary/Math/FFT/Filters 参数及批处理、Convolve、Watershed、Inverse FFT；命令处理当前切片并创建新 Frame |
| Analyze | Measure、Summarize、Distribution（测量值直方图）、Label Selection、Clear Results、Set Measurements（显示字段）、Set Scale（面积单位）、Histogram、Plot Profile、ROI Manager | Analyze Particles、Skeleton 分析、更多 Set Measurements 指标、校准与完整结果表、Profile 插值及 ROI Manager 全部操作 |
| File/Edit | Open、Close Frame、预览 PNG/CSV 导出；选区创建、调整、指定、ROI Manager/Overlay；当前 Frame 翻转和正交旋转的十步 Undo/Redo | New/Import/Save As 多格式、其他操作的 Undo/Redo、剪贴板、完整 Edit Options |

## 关键行为与限制

- B&C 在 Frame 首次呈现时由所选自动方式计算，然后把该 Frame 的 Min/Max 固定。切片切换沿用这组数值；只有在 Adjust 中再次选择自动方式或手动修改才变化。
- Layout 的第一列勾选控制显示，第二列勾选控制是否参与参数锁。刚加入锁定组的 Frame 从已勾选的 Frame 继承当前勾选的参数组。退出锁定组后保留自己的参数。
- Duplicate 对 2D 图像提供标题；对 stack 提供 Duplicate stack 与切片范围；面积选区可裁切或忽略。多轴 hyperstack 暂时用线性切片序号表示范围。
- Montage 按 Scale (%) 缩放每张切片，再按指定列数排布；灰度输出保持原始 dtype，比例为 100% 时保持原始数值。翻转与正交旋转替换当前 Frame 的显示内容并保留其 stack 切片，源文件不写回磁盘。最多记录十次撤销。
- ImageJ 核心内置 LUT 之外，vivi 还提供 [ImageJ 官方 LUT 归档](https://imagej.net/ij/download/luts/luts.zip)的 68 个原始色表和先前的自定义色表。来源与转换方式见 [`backend/IMAGEJ_LUTS.md`](../backend/IMAGEJ_LUTS.md)。这覆盖该归档中的全部 `.lut` 文件，不包含第三方插件或用户自行安装的 LUT。
- 图像处理操作目前仅取当前切片；多数 ImageJ 原命令可直接修改像素，而 vivi 生成新 Frame。数值算法在同名但简化的操作上可能与 ImageJ 不逐像素相同。
- Threshold 在显示层将 Min 到 Max 之间的原始像素显示为白色，范围外为黑色。Process → Binary → Make Binary 则创建真实二值图像。
