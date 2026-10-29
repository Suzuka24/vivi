# 大文件加载、压缩、传输与缓存

[English](loading-and-transport.en.md) · [返回使用指南](usage.md)

## 数据在哪里处理

vivi 的 Node 扩展和 Python worker 都运行在**扩展主机**：

- 本地窗口：扩展主机就是本机；
- Remote SSH：扩展主机是服务器，源文件不会先下载到笔记本；
- Python 读取 TIFF/FITS/图像序列并生成预览像素；
- 预览 payload 通过编辑器连接到达 Webview，本机浏览器侧完成解压、Byte Unshuffle、dtype 解码、初始 B&C/LUT 着色和图像对象构建。

默认传输保持源 dtype 的字节布局。例如 `uint8` 不会为了传输变成 `float64`。只有显式开启有损预览时，浮点预览才会按所选方法近似编码；源文件和服务端分析仍不改变。

## 当前加载流水线

### 单张图像

1. Python 打开源文件并读取需要的像素。
2. 如符合条件，先执行有损预览编码。
3. 如开启无损压缩，再执行 Byte Shuffle 和所选压缩器；没有压缩收益时可保留原始字节路径。
4. 默认 HTTP 模式用一个带 `Content-Length` 的连续响应传输 payload。
5. Web Worker 在浏览器线程外解压、恢复 dtype、着色并构建图像。
6. 图像完成后显示，源文件句柄立即释放。

固定长度 HTTP payload 的进度条表示**已接收字节数 / 总字节数**。后续本地解码和首次绘制可能仍需要短暂时间，但不会伪装成网络百分比。

### Stack 和图像文件夹

1. Python 按源 slice 顺序读取和编码。
2. 所有 slice 通过同一个 HTTP response 连续发送，每个记录带有 frame 序号、总帧数、元数据和 payload 长度；不会为每帧重新建立一次 HTTP 通信。
3. Node 端使用背压：浏览器接收速度下降时暂停继续写入，避免无限堆积远端内存。
4. 浏览器使用双缓冲：解码当前 slice 时可以继续接收下一条记录，使传输和本地解码重叠。
5. 每个 slice 完成解码和初始着色后进入临时缓存；进度按已构建 slice 数 / 总 slice 数更新。
6. 所有 slice 完成后，整个 stack 一次性进入可见状态。首帧不会提前显示，远处 slice 也不会延后到第一次访问时才构建。

连续 stack response 事先没有最终压缩总字节数，因此它的百分比代表**已完成 slice 数 / 总 slice 数**，不等同于精确网络字节进度。Layout 同时显示加载旋转标志；加载结束后进度和标志消失。

## HTTP 与 postMessage

`vivi.transportMode` 提供两种模式：

| 模式 | 行为 | 取消 | 进度 |
| --- | --- | --- | --- |
| `http`（默认） | 单 payload 或单次连续 stack response；Remote SSH 通过扩展转发 | 关闭加载中的 Frame 会 abort fetch、关闭 response 并停止对应 Python worker | 单图按字节；stream stack 按完成 slice |
| `postMessage` | 使用 Webview 消息传递已有 payload/stream event，保留用于兼容 | 已经提交的单条大消息不能在编辑器内部立即中止 | 取决于可观察到的 frame 事件，无法报告单消息的部分接收 |

如果 HTTP endpoint 无法建立，vivi 会回退到 `postMessage`。HTTP token 单次有效，完成或取消后立即失效。

## Web Worker 与界面响应

解压、Byte Unshuffle、dtype 恢复、校准、初始 B&C/LUT 和图像构建在每个 Frame 的 Web Worker 中进行，避免这些 CPU 任务长期阻塞查看器主线程。关闭 Frame 会终止其 worker 并拒绝仍在等待的任务。

这不能消除所有卡顿来源：Remote SSH 带宽、浏览器内存分配、极大的最终 canvas/image 对象，以及同一编辑器进程的资源竞争仍可能影响响应。当前版本不主动限速，也不为显示进度添加额外固定大小的应用层分块；优先保持连续传输速度。

## 压缩顺序与设置

有损和无损是两个独立阶段，执行顺序为：

```text
源 dtype 像素
  → 可选有损预览编码
  → 可选 Byte Shuffle + 无损压缩
  → HTTP/postMessage
  → 无损解压 + Byte Unshuffle
  → 有损格式解码
  → 显示像素
```

### 无损压缩

- `vivi.losslessCompression` 默认开启；
- `vivi.losslessMethod` 默认 `zstd1-shuffle`；
- 可选 `zstd3-shuffle` 和兼容方案 `zlib1-shuffle`；
- 所有无损方法都能逐字节恢复其输入；Byte Shuffle 只是把同一数值中相同字节位置聚集起来，提高浮点和多字节整数的可压缩性。

### 有损预览

- `vivi.lossyCompression` 默认关闭；
- 只对源文件严格大于 `vivi.lossyMinFileMiB` 的浮点预览启用，默认阈值 128 MiB；
- 默认 `zfp`，误差由 `vivi.lossyTolerance` 控制；
- 还可选 float16、bfloat16、64×64 分块 8/12/16 位量化；
- 整数图像、图像文件夹和包含非有限值而不适合某编码器的平面会保留原始路径；
- 有损开启后，屏幕像素读数来自近似预览。需要精确像素读数时应关闭有损预览。

## 短期内存缓存

`vivi.recentCacheSeconds` 默认 20 秒：

- 只缓存最近打开的三张**单幅图像** transport payload；
- 缓存在当前 Webview 的本机内存中，不写入磁盘，不跨窗口重启；
- 计时从首次打开开始，重复重开不会无限延长期限；
- 超过三个、超过时限、查看器释放或设置为 `0` 时清除；
- 缓存键包含路径、文件大小、修改时间、状态变更时间和 inode。文件被覆盖或重写后会重新加载，不会复用旧 payload。

Stack 不使用这项短期 transport payload 缓存；打开后的 stack slice 图像保存在该 Frame 的内存缓存中，以支持立即切片和显示参数重绘。

## 文件句柄与源文件修改

完整预览 payload 交付后，Python 会立即关闭 TIFF、FITS、普通图像、视频或图像序列句柄。之后的 Histogram、Measure、Header、处理或重新渲染需要时再重新打开源文件。这意味着已经打开的文件不会长期阻止外部程序覆盖或重写。

当前 Frame 表示双击当时加载到的工作副本。vivi 不持续监视源文件变化；如果磁盘文件更新，用户应重新打开。短期 payload 缓存在重开时会先检查源文件身份，检测到变化就重新读取。

## 内存与性能注意事项

- 当前没有 stack 预览尺寸或总缓存 MiB 上限。完整 stack 会构建所有 slice，可能同时占用压缩 payload、原始 TypedArray、着色 canvas/image 和辅助缓存内存。
- `vivi.maxDecodedPixels` 只保护必须整帧解码的 PNG/JPEG/BMP/GIF/视频，不是 stack 内存预算；TIFF/FITS 通常按页面或区域读取。
- 无损压缩对低熵数据通常节省传输，对噪声数据可能没有收益；Zstd level 1 偏向速度，level 3 偏向体积。
- Remote SSH 中若网络是瓶颈，压缩通常有利；本地高速磁盘上，压缩 CPU 时间可能超过传输收益。
- 多个文件可各自加载，但每个完整 stack 仍会占用独立 worker、内存和连接资源。

遇到问题时运行 **vivi: Check Python Backend**，并在 **输出 → vivi** 查看后端、传输、本地解码和首次绘制阶段的诊断时间。
