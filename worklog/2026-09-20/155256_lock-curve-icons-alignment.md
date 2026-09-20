# 锁定、曲线与工具栏图标调整

## 计划

- 目标：使 All lock/Unlock 仅修改 Frame 参与锁定的选框；简化 Adjust；改善指定图标与正交视图对齐。
- 范围：Layout/Adjust 侧栏、viewer 工具栏与三视图绘制，不修改未指定的工具图标。
- 步骤：分离 Frame 参与状态和同步参数状态；移除侧栏 Threshold；设计 SVG 图标；统一正交侧图的 CSS 与画布坐标。
- 验证：静态检查和已有测试，打包安装，在远程 Cursor 用真实 TIFF 检查交互与几何。

## 实施记录

- 参考 Fluent UI System Icons 的常见旋转等语义，自绘 SVG，保留项目现有线条图标风格。
- All lock/Unlock 只修改各 Frame 的 `lockMember`；五项同步参数保持原状态。
- 将 Adjust 的 B&C 显示开关和图窗标题改为 Curve，移除侧栏 Threshold 选项，保留菜单中的 Threshold 命令。
- 正交侧图的像素倍率与主图统一，使用实际布局宽高设置画布缩放；分隔线作为覆盖层绘制，不占用图像尺寸。
- 重新绘制指定的十个工具图标，扩大右侧八个图标本体；未调整其他图标。

## 总结

- 已完成上述修改。`npm run check`、`npm test`（12 项）、`git diff --check` 和 `npm run package` 通过。
- 在远程 Cursor 独立窗口打开真实 101 层 TIFF 和 PNG，验证两个 Frame 的 All lock/Unlock 只切换参与状态，B&C 同步选项始终保留；ADJUST 显示 Curve 且无 Threshold；正交视图在单帧真实 TIFF 上显示，XZ/YZ 与主图的相应边界对齐。
- 本地与远程 Cursor 均安装 0.6.12 VSIX。原远程窗口未刷新；使用新窗口检查。
- 剩余风险：正交侧图在极端非整数浏览器缩放比例下可能有显示层面的抗锯齿差异；本次远程实际窗口未见边界偏差。
