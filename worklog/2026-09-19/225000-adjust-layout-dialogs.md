# 计划

目标：修复远程 Cursor 中的工具栏、LAYOUT、ADJUST、B&C 图和分析弹窗布局，并发布开发版到远程主机。

范围：仅修改查看器和侧栏 Webview 的 HTML、CSS、JavaScript；保留现有数据读取和图像处理后端。

步骤：检查 ImageJ B&C 逻辑；调整固定像素范围、滑块和曲线；修复 frame 列表与弹窗；打包并在 hyh-batchcom2 的 Cursor 中验证。

验证：JavaScript 静态检查与现有测试；远程打开真实 TIFF、双 frame 平铺、数值输入、直方图和最小化。

# 实施记录

- 查阅 ImageJ `ContrastAdjuster.java`：Minimum/Maximum 控制显示映射端点，Brightness 移动显示区间，Contrast 围绕中心改变区间宽度。本项目按用户指定将 Contrast 数值映射到 0–90° 的曲线斜率。
- 将侧栏显示范围固定为当前 frame 第一次取得的像素 extrema；支持手动输入范围外数值。
- 调整曲线、显示数值、frame 列表、工具栏及弹窗样式。
- 远程 Cursor 已用真实服务器 TIFF 验证两张图进入同一标签页并在 Layout 中显示；平铺切换和 Pointer 默认工具正常。曾以 -1 测试范围外 Minimum 输入。
- 开发版 0.6.4 已安装在 `hyh-batchcom2` 的 Cursor Server 和本机 Cursor。远程重载后再次打开真实 TIFF，确认 ADJUST 数值保留精度；Reset 后 Minimum/Maximum 滑块分别位于端点，Brightness/Contrast 均为 0.5；输入 -1 后 Minimum 滑块仍位于最左端；最小化 B&C 后曲线从界面中隐藏。
- JavaScript 静态检查及 7 项 Node 测试通过。当前系统 Python 缺少 `zarr`，Python 测试未通过运行环境检查；改动均在 Webview 层，远程实际 TIFF 打开和渲染已验证。

# 总结

已完成工具栏、LAYOUT、ADJUST、B&C 图与分析弹窗的本轮改动，版本为 0.6.4。远程和本机均已安装，商店未发布。剩余限制：本机 Python 测试环境缺少 `zarr`；需继续用实际屏幕观察不同宽度下的窗口布局。
