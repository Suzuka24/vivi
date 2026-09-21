# 高维读入、Frame 同步与 ImageJ 行为对照

## 计划

### 目标

- 本地保留且不提交 ImageJ 1.x 官方源码，作为行为和算法参考。
- 为单文件增加 Open As 高维轴映射，支持 FITS 多 HDU 列表及类似 `rearrange` 的轴组合。
- 修复 tile 实时刷新和 Frame lock 原子同步；新增 Selection lock。
- 文件夹导入按用户指定或首个合格文件的 H/W 筛选。
- 将图像处理与分析命令改为当前 Frame 原位操作，并依据 ImageJ 1.x 源码补齐算法、参数窗口和结果显示。

### 范围

扩展主机的打开流程、Python Source 维度模型、Explorer/Open As 界面、viewer Frame 状态与同步、原位处理与 undo/redo、Image/Process/Analyze 菜单及测试和文档。

### 关键步骤

1. 拉取 `imagej/ImageJ` 到被本地 Git exclude 忽略的 `ref/ImageJ`，建立源码类映射。
2. 增加只读 inspect 和 axis layout parser；实现 Open As 列表及验证不关闭弹窗。
3. 为文件夹序列增加 H/W 过滤参数和跳过不匹配文件的统计。
4. 重写 lock 传播为批量状态更新，tile 立即重绘，并同步 selection。
5. 将 derive 类命令接入当前 Frame 的变换队列和十步 undo；按 ImageJ 实现校正核心滤波与分析命令。
6. 运行 Node/Python 测试、打包，并优先在 hyh-batchcom2 Cursor 验证多维 TIFF、tile lock 与菜单操作。

### 验证方式

- 单元测试覆盖轴表达式、通道自动识别、文件夹 H/W 筛选及同步状态。
- `npm run check`、`npm test`、`npm run test:python`、`npm run package`。
- 远程 Cursor 使用实际 4D TIFF/FITS 和多个 Frame 做交互验证。

## 实施记录

- 已拉取 ImageJ 1.x 官方仓库到 `ref/ImageJ`，并在 `.git/info/exclude` 中忽略 `ref/`。
- 已定位主要参考类：`ContrastAdjuster`、`Filters`、`ContrastEnhancer`、`MaximumFinder`、`Binary`、`RankFilters`、`ImageMath`、`FFT/FFTFilter`、`Analyzer`、`ProfilePlot`、`StackStatistics`、`ZProjector`。
- 新增 `backend/axis_layout.py`。单文件可先 inspect，再按源轴字母重排或折叠；例如 `u v h w` 可映射为 `uv h w`，读取单帧时直接换算回原存储索引，不复制完整高维数组。对未知轴的 `3×H×W` 自动呈现为 `H×W×3 (h w c)`，也允许改为 `c h w` 作为三张灰度切片。
- Explorer 文件右键新增 Open As。弹窗逐项展示 TIFF series 或 FITS HDU 的源 shape、源轴和目标 shape；非法表达式在弹窗内报错并保留用户输入。
- 文件夹 stack 在模式选择后可选填 `H W`。留空时以首个合格图像为基准，只合并尺寸一致的文件或平面。
- Layout 新增 Selection lock。B&C、LUT、View、Zoom、Slice 和 Selection 均通过同一传播路径同步；tile 刷新等待全部可见目标完成后一次性换图，避免逐 Frame 闪烁。滚轮、播放、按钮和滑块切片均复用 slice 同步路径。
- 图像变换和单输出 Process 操作改为替换当前 Frame 的临时工作副本，并沿用十步 undo/redo；stack 操作保留未处理的其他平面。Split Channels、Stack to Images 等多输出命令仍创建新 Frame。
- 依据 ImageJ 1.x 的内置实现核对 Smooth、Sharpen、Find Edges，并补充 Remove Outliers、Convolve、Watershed、Stack to RGB、Merge Channels 等入口。保留原尺寸 FFT 与 ImageJ 幂次补齐 FFT 两种模式。
- 文档更新到 0.7.0，明确已实现范围、工作副本语义和当前差异；`ref/` 同时加入 `.gitignore` 和 `.vscodeignore`，不会进入仓库或 VSIX。

## 总结

### 完成内容

- 完成单文件高维 Open As、FITS 多 HDU/TIFF 多 series 列表、轴折叠及通道识别。
- 完成文件夹 stack 的可选 H/W 筛选。
- 完成 tile 原子刷新及六组 Frame lock（含 Selection）的实时同步。
- 完成主要 Image/Process/Analyze 操作的当前 Frame 原位执行和十步撤销。
- 本地、hyh-batchcom2、ssk-CAST 均安装 `Suzuka24.vivi 0.7.0`，三处关键文件 SHA-256 与源码一致。

### 验证结果

- `npm run check`：通过。
- `npm test`：21/21 通过。
- `.venv-local/bin/python -m unittest discover -s tests -p 'test_*.py' -v`：41/41 通过。
- `npm run package`：生成 48 文件、约 283 KB 的 `vivi-0.7.0.vsix`，未包含 `ref/`。
- hyh-batchcom2 Cursor 实测 101×795×795 float32 TIFF：Open As 弹窗与错误保留正常，slice 滑块从第 1 帧实时切到第 39 帧，预加载完成 101/101；Selection lock 在 Layout 中可见。
- 同一远程文件的后端计时：inspect 约 0.150 秒、open 约 0.001 秒、首帧 pixel 约 0.039 秒、远帧 pixel 约 0.000 秒、完整帧 histogram 约 0.007 秒。

### 剩余差异和风险

- ImageJ 的 Find Maxima 全部输出模式、Analyze Particles、完整 ROI Manager 与部分高级参数仍标灰或为简化模式，详见 `docs/imagej-menu-coverage.md`。
- Inverse FFT 仍标灰。ImageJ 依赖附着在结果图上的复数 FHT 属性，当前 TIFF 工作副本只保存功率谱，无法无损还原该属性。
- Open As 支持重排和合并已有轴；暂不支持把一个源轴拆分成多个新轴。
- NumPy/tifffile 测试出现上游弃用警告，不影响本次 41 项测试结果。
