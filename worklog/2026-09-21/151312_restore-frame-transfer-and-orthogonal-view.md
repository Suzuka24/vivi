# 逐帧传输与 Orthogonal 视口修复

## 计划

- 将 stack 传输恢复到 `1867f03` 的逐帧请求与缓存方式，移除整栈 `renderBatch` 通道。
- 让 flip、rotate 操作服从 View lock，并对所有已加入 lock 的 frame 执行。
- 修复 tile orthogonal 绘制，使 zoom、pan 和 Shift 配合的工具操作使用 frame 的 `scale/cx/cy`。
- 运行前端、扩展和 Python 后端测试，打包后安装至本机、hyh-batchcom2、ssk-CAST，并推送 GitHub。

## 实施记录

- 已恢复 `1867f03` 的逐帧预加载顺序：从当前帧开始，向前后相邻帧扩展；每帧独立请求、解码、着色并写入缓存。
- 已移除 Webview、扩展 host 和 Python worker 中的 `renderBatch` 通道与对应测试。
- tile orthogonal 的 XY/XZ/YZ 现在共同使用 frame 的 `scale/cx/cy`，并保留 tile 内 fit 比例；缩放与平移会立即改变实际绘制区域。
- flip、左右 90° rotate、180° rotate及任意角度 rotate 会在 View lock 开启且当前 frame 已加入 lock 时，对所有 lock frame 执行。
- 已通过 JavaScript 静态检查、21 项 Node 测试和 44 项 Python 测试。
