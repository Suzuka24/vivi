# Explorer 与曲线交互完善

## 计划

- 为 Explorer 增加按目录保存的最近打开项目状态，并用区别于 hover 和当前选择的样式显示。
- 修复 Orthogonal Views 中 Space 调用工具后 Shift 约束失效的问题。
- 将 LAYOUT 的 Frame 切换图标改为上、下方向。
- 重写 Plot Profile 和 Z-axis Profile 的画布布局，支持刻度、网格、边框、坐标提示和窗口缩放。
- 运行静态检查和测试，打包并安装到本地、hyh-batchcom2、ssk-CAST 的 Cursor。
- 在目标 TIFF 上独立测试当前逐帧传输、连续流式传输及多种压缩组合，不把基准测试代码并入 vivi。

## 验证方式

- `npm run check`、`npm test`、Python 单元测试和 VSIX 打包。
- 检查工作区差异及临时文件。
- 三端通过扩展目录和版本号确认安装结果。
- 传输测试记录应用层字节数、端到端总耗时、压缩与传输耗时。

## 实施记录

- 采用按父目录保存最近激活子项的状态：进入目录、打开文件、Open As、Open Folder as Stack 以及返回父目录时更新；切换到无关目录不会错误高亮。

- Explorer 最近项目使用弱选中背景和左侧强调线；hover 使用更亮的 active-selection 色，当前选择状态仍独立。
- Orthogonal 工具快捷键允许额外 Shift，同时恢复矩形/椭圆比例约束和直线 45° 角度约束。
- Frame 切换按钮改为上、下 chevron 图标。
- 交互曲线重写为响应式画布，增加完整 plot box、横纵网格与刻度、曲线裁剪、hover 十字及坐标读数；Profile 与 Z-axis Profile 容器可拖动、缩放。
- 版本更新至 0.7.11。

## 验证结果

- `npm run check` 通过。
- Node 测试 21/21 通过。
- `.venv-local` Python 测试 44/44 通过；只有 tifffile/NumPy 上游弃用警告。
- `npm run package` 生成 `vivi-0.7.11.vsix`。
- 本地 Cursor、hyh-batchcom2 Cursor Server、ssk-CAST Cursor Server 均安装 0.7.11；三端 `media/viewer.js` 与 `media/explorer.js` SHA-256 一致。

## 传输基准阶段记录

目标文件为 101×795×795 float32、无 TIFF 压缩，文件大小 255,356,172 字节。按用户调整后的策略，先在 hyh-batchcom2 仅编码并统计所有应用层载荷，不进行远程到本机传输。完整数据见 `160633_payload-sizes.jsonl`。

- raw：243.510 MiB（100%）
- lossless shuffle+zlib：151.717 MiB（62.30%）
- ZFP：43.136 MiB（17.71%）；ZFP+zlib：42.571 MiB（17.48%）
- float16：121.755 MiB（50.00%）；+zlib：67.058 MiB（27.54%）
- bfloat16：121.755 MiB（50.00%）；+zlib：52.528 MiB（21.57%）
- block8：61.008 MiB（25.05%）；+zlib：33.926 MiB（13.93%）
- block12：91.447 MiB（37.55%）；+zlib：72.113 MiB（29.61%）
- block16：121.886 MiB（50.05%）；+zlib：95.604 MiB（39.26%）

此前已完成的一项真实传输结果保留作参考：raw 逐帧 243.510 MiB，端到端 346.740 秒，0.702 MiB/s。连续 raw 测试按用户要求中止，不据此推断时间。

所有本地和远端 `/tmp` 基准脚本已删除，SSH 基准复用连接已关闭。

## 总结

已完成 Explorer 最近打开项高亮、Orthogonal Space+Shift 工具一致性、Frame 上下切换图标和响应式交互曲线窗口，并完成三端安装。实际传输时间测试暂停，等待用户从体积结果中选择需要实测的方案。

## 完整编解码基准补充

按用户后续要求，在同一目标 TIFF 上完成无损及有损算法的纯计算基准。数据先完整读入内存，排除磁盘和网络；保持 vivi 的逐 slice 编码方式。每项预热后运行三次，报告中位数。无损验证解压字节完全相同；有损误差对全部 63,834,525 个 float32 像素统计。原始数据动态范围为 0.4921606183。完整原始结果见 `160633_codec-benchmark.jsonl`。

- 无损综合：Zstd-1 + Byte Shuffle 为较好的速度/体积平衡（153.102 MiB，压缩 0.859 s，解压 0.678 s）；Zstd-3 + Shuffle 体积最小（148.660 MiB，压缩 1.525 s，解压 0.696 s）。两者均显著快于当前 zlib-1 + Shuffle（151.716 MiB，5.974 s，1.497 s）。
- 无损速度：不做 Shuffle 时 Snappy 最快（压缩 0.197 s，解压 0.151 s，194.801 MiB）；LZ4 为 0.327/0.127 s，192.447 MiB。
- 有损综合：ZFP 在 43.135 MiB 下达到 MAE 7.711e-7、RMSE 1.298e-6、最大误差 1.335e-5，压缩/解压为 1.232/0.958 s。在本文件上其体积与误差同时优于 float16、bfloat16、block8 和 block12。
- 极低误差：block16 的 MAE 1.245e-7 最小，但体积为 121.885 MiB；其压缩率远低于 ZFP。
- 所有本地及远端临时基准脚本已删除，SSH 复用连接已关闭。
