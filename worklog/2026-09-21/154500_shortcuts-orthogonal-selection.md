# 快捷键与 Orthogonal Selection 同步

## 计划

- 更新 Pointer、Rectangle、Oval、Measure、Frame display 的默认快捷键。
- 将 Orthogonal Views 中启用当前工具的手势从 Shift+鼠标改为 Space+鼠标。
- 修复 tile + orthogonal + selection lock 时非当前 frame 不显示同步选区的问题，并确认其他锁定行为仍复用普通 tile 的同步状态。
- 完成静态检查、Node/Python 测试和打包，安装到本地、hyh-batchcom2、ssk-CAST，提交并推送 GitHub。
- 对照 ImageJ 源码分析相同数据量下的传输与加载策略，不修改传输实现。

## 实施记录

- 已定位到 Selection lock 会正确复制选区；orthogonal tile 的非当前 frame 绘制分支遗漏了 selection overlay。
- 已补充 orthogonal XY 区域的同步选区绘制，并接入相同的 `scale/cx/cy` 布局。
- 已增加 Space 键状态跟踪，Orthogonal Views 中默认使用 `space+click` 才进入当前工具操作，否则保持十字线操作。
- 默认快捷键更新为 Pointer=P、Rectangle=R、Oval=C、Measure=M、Frame display=D。
- `npm run check`、21 项 Node 测试和 44 项 Python 测试均通过。

## 传输策略分析

- ImageJ 普通 URL TIFF 通过 `Opener.openURL()` 创建连续 `InputStream`；`FileOpener.openStack()` 在同一数据流中按 slice 顺序读取，外层通过 `Reading: i/n` 和 `IJ.showProgress(i,n)` 报告进度。TIFF 元数据解析使用 `RandomAccessStream`，对网络流以 1 KiB 内存块缓存来支持回看；解析后通常会重新打开 URL 获取像素流。
- vivi 0.7.9 在 Remote SSH extension host 上由 Python 按帧读取原始数组，经 stdout 二进制帧传到 extension host，再通过 Webview 消息传到本机；预加载循环等待一帧完整到达、解码和着色后才请求下一帧。
- 在不考虑压缩、双方传输相同字节量的前提下，ImageJ 的连续流通常吞吐更高：网络保持连续发送，避免每帧一次串行请求往返。vivi 的优势是远端可直接 seek、可优先当前帧、可取消或按需读取，但“确定会读取全部 stack”的场景会付出 N 帧串行消息、协议和内存复制开销。

## 总结

- 已生成并安装 `Suzuka24.vivi 0.7.9` 到本地 Cursor、hyh-batchcom2 和 ssk-CAST；两台远端均确认新快捷键及 `space+click` 默认值，临时 VSIX 已删除。
- 实现提交 `74b08b6` 已推送到 GitHub `main`。按用户要求未操作 Cursor 窗口，实际交互由用户验证。
