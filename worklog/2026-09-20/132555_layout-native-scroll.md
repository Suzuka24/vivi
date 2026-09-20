# Layout 原生滚动修复

## 计划

- 目标：使 Layout 超出侧栏高度的 Frame 可通过鼠标滚轮访问。
- 范围：Layout Webview 的滚动容器和列表重绘；不改动 Frame 操作。
- 步骤：在远程 Cursor 复现；检查 CSS 高度及 wheel 监听；改为单层原生滚动；验证并更新远程安装。
- 验证：静态检查、Node 测试、打包、远程 Cursor 多 Frame 滚轮操作。

## 实施记录

- 远程 Cursor 已运行 0.6.8，Layout 同时有四个 Frame；旧版滚动时控件和列表被不同层级裁切。
- 移除 Frame 列表的强制 wheel 监听及伸展高度，让 Layout 内容区成为唯一的原生垂直滚动容器。
- Frame 状态重绘时恢复内容区的滚动位置。

## 总结

- 远程 Cursor 独立窗口安装 0.6.9 后打开 9 个 Frame。初始 Layout 只显示至第 7 个；鼠标滚轮向下后第 8、9 个 Frame 出现，向下浏览成功。用户原有的四帧窗口没有重载。
- 浏览器尺寸探针中，100 个 Frame 时滚动区可视高度为 469 px，内容高度为 2726 px，滚动位置可达 2257 px。
- `npm run check`、12 项 Node 测试、`npm run package` 通过。已安装本地和远程 Cursor。
