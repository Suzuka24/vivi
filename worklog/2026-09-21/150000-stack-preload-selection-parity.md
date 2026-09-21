# Stack 预加载、Selection 与 ImageJ 交互对齐

## 计划

### 目标

- 分析并优化小 plane、大帧数 TIFF 的预加载速度，保持原始 dtype 和现有压缩策略。
- 让 Reslice 使用当前 line selection。
- 让区域 Selection 限定 Smooth 等像素处理的作用范围，并提供 ImageJ 风格状态信息。
- 为 Skeleton 增加输入类型检查和明确错误。
- 调整 Montage 默认列数。
- 将一维曲线改为可交互图，并统一统计窗口的尺寸与表格布局。

### 范围

Python worker 批量读取与图像处理、扩展主机二进制转发、viewer 预加载/Selection/绘图/统计窗口，以及直接相关测试和文档。

### 关键步骤

1. 对目标 TIFF 分别测量整文件读取、整体解码和逐帧协议开销。
2. 增加保留 dtype 的 renderBatch 协议，以整个 stack 为单一传输单元执行可选压缩，本机拆帧并提前构建全部 canvas；首帧不提前显示。
3. 按 ImageJ `Slicer` 的 line profile 语义实现 line reslice。
4. 按 ImageJ ROI 处理规则在区域外恢复原像素；校验 Skeleton 必须为 8-bit binary。
5. 增加交互 Plot 组件和无边框统计表格，修正窗口尺寸。
6. 运行 Node/Python 测试、打包，并在 hyh-batchcom2 Cursor 使用目标 TIFF 验证。

### 验证方式

- 对目标 TIFF 比较修改前后的完整预加载耗时和请求次数。
- 单元测试批量传输 dtype/顺序、line reslice、selection 限域、Skeleton 报错和 Montage 默认值。
- `npm run check`、Node/Python 全套测试、VSIX 打包和远程 Cursor 交互验证。

## 实施记录

- 目标 `wdf_c0.tiff` 大小 1,020,244 bytes，shape `15×15×33×33`，float32，无压缩，225 pages。远程 `tifffile.asarray()` 整体读取约 0.81 ms，225 page 逐页读取合计约 39 ms，vivi 原 `Source.read` 逐 plane 合计约 43 ms；原实现的主要成本是 225 次独立协议往返和分散的前端构建。
- `renderBatch` 现在一次读取并传输完整 stack，保留源 dtype；有损与无损压缩仍按现有设置依次作用于同一个完整载荷。Webview 收齐后拆分 typed-array view，并为全部 slice 建立 canvas，再首次显示图像。
- Auto、MinMax、Percentile 和 ZScale 在打开 stack 或用户触发时根据当前 slice 确定一次共享 B&C 范围，之后应用到整个 stack；存在面积 selection 时，Auto/Reset 仅用选区像素计算。切换 slice 只刷新 Curve 的直方图和数据范围，Minimum、Maximum 与显示曲线保持不变，不重新读取或传输。
- Reslice 使用当前直线、分段线或自由线逐层采样；区域 Selection 会限制 Smooth 等支持的 Process 操作，区域外像素保持不变。Skeleton 对非 8-bit binary 输入返回明确提示。
- Montage 默认列数使用 slice 数平方根取整。一维 profile 支持悬停读数、滚轮缩放、拖动平移和双击复位；Measure Stack 等结果改为可滚动的无边框表格。

## 总结

- 0.7.3 恢复 stack 共享 B&C 语义，并补充当前切片、当前面积 selection 的 Auto/Reset 计算；Python 45/45、Node 21/21 和静态检查通过。

- 自动化验证：Python 45/45、Node 21/21，`npm run check` 和 VSIX 打包通过。
- hyh-batchcom2 Cursor 打开目标 TIFF：先保持 `0/225 ready` 和 Loading 状态，完成后一次变为 `225/225 ready`，首次显示发生在全部 slice 的 canvas 构建完成后；本轮观察到总时长约 1.5–3 秒。
- `Suzuka24.vivi 0.7.1` 已安装到本地、hyh-batchcom2 和 ssk-CAST，两个远程安装目录的 `viewer.js` 与 `worker.py` SHA-256 均和源码一致。
- 未完成事项：对数 GB 级 stack 的单一载荷会带来较高峰值内存，这是用户明确要求的整体加载语义；当前未设置预览缓存预算上限。
