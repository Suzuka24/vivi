# 传输回退与 Tile lock 实时显示

## 计划

- 目标：仅将 stack 传输恢复到 `85e7e53` 的父提交 `dafe394` 的行为，保留当前其他功能；修复 Tile 模式中多个可见 lock Frame 无法实时同步 B&C 的问题。
- 范围：Python 到 extension 的二进制接收、Webview stack 状态显示、批量预览构建和 Tile 缓存重新着色；版本、变更记录、构建与三处 Cursor 安装。
- 关键步骤：移除后续进度回调残留并恢复完整 stack 单 payload/ready 计数；修正 Tile 对已有 canvas 的错误快速路径；运行静态检查、Node/Python 测试、打包及差异检查；提交推送并安装到本地、hyh-batchcom2、ssk-CAST。
- 验证方式：自动化检查及安装文件校验；按用户要求不代替用户进行最终 UI 功能验证。

## 实施记录

- 以 `85e7e53` 的直接父提交 `dafe394` 为基准恢复传输行为：删除 backend 和 Webview 的进度回调残留、删除临时进度条 UI，恢复完整 stack 单 payload 和 `n/总数 ready` 状态；保留此后加入的 B&C、Tile Orthogonal、同步播放等功能。
- 修复 Tile 刷新复用已有 canvas 时跳过重新着色的问题。B&C、LUT/颜色和 Slice 改变会立即使当前及所有 lock 成员的旧异步任务失效；刷新使用各 Frame 当前缓存重新着色，所有可见目标完成后统一绘制。
- 版本更新为 0.7.7，并删除只适用于 0.7.5 进度协议的 Node 测试。
- 本机使用项目 `.venv-local` 执行 Python 测试；系统 Python 缺少 `zarr`、`cv2`、`zfpy`，不作为验证环境。
- 打包 `vivi-0.7.7.vsix`，确认包内 `viewer.js`、`backend.js`、`worker.py` 与源码逐字节一致。
- 0.7.7 已安装到本地 Cursor、hyh-batchcom2 Cursor Server 和 ssk-CAST Cursor Server；三处安装版核心文件 SHA-256 一致。远端临时 VSIX 已删除，安装用临时 server 进程已终止。

## 总结

- 完成传输行为定点回退和 Tile lock 实时显示修复，未回退其他新功能。
- `npm run check`、21 项 Node 测试、45 项 Python 测试、`npm run package`、`git diff --check` 均通过。
- 按用户要求不代替用户进行最终 UI 功能验证；安装后的已打开 Cursor 窗口需要 Reload Window 才会载入 0.7.7。
