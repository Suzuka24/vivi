# 鼠标手势、切片播放和翻转状态

## 计划

目标：统一图像滚轮、双击、正交视图中的工具手势；配置 24 FPS 默认值和鼠标快捷键；显示翻转状态与处理进度。
范围：viewer Webview、侧栏切片按钮、扩展主机变换队列、插件设置与使用文档。维持图像原始数据及缓存流程。
关键步骤：修改事件路由；连接配置；为每个 Frame 维护翻转状态并随 undo/redo 回退；增加处理提示；运行静态检查、单元测试、打包，随后在远程 Cursor 验证并部署。
验证：`npm run check`、`npm test`、`npm run package`，检查设置 JSON 与远程安装状态；在远程 Cursor 检查交互。

## 实施记录

- 滚轮默认切片，上滚前进；Shift 和平台修饰键分别执行鼠标锚点缩放和中心缩放。
- 长按切片箭头以当前 FPS 间隔连续切换；默认 24 FPS 并可配置。
- Hand 默认 H，Oval 默认 O；正交视图需 Shift 使用选定工具；双击 Fit。
- Frame 翻转状态及 undo/redo 栈同步；变换期间显示覆盖提示。

## 总结

已完成滚轮、双击、正交视图工具手势、长按切片、默认 FPS、Hand/Oval 快捷键、翻转状态与处理提示，并将鼠标手势作为可配置设置项。

验证：`npm run check` 通过；`npm test` 21/21 通过；`npm run package` 生成 0.6.24 VSIX。hyh-batchcom2 的远程 Cursor 上使用 101 帧 TIFF 核验默认 24 FPS、上下滚动切片方向、双击 Fit、翻转提示与高亮，以及撤销后的高亮恢复。最终 VSIX 已在本地、hyh-batchcom2、ssk-CAST 安装；两台远程主机上的 viewer.js 与 package.json 的 SHA-256 均和本地一致。手工验证产生的两份 `/tmp/vivi-derived-*.tif` 已删除。

剩余风险：未通过 UI 自动化逐项验证 Shift/Command+滚轮和正交视图中的 Shift 拖动；其修饰键判断与相关事件路径已代码审查。实际播放帧率仍受未预加载帧的解码速度限制。
