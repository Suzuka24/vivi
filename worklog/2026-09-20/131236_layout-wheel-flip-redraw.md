# Layout 鼠标滚轮与 stack flip 重绘

## 计划

- 目标：让 Layout 的 Frame 列表可用鼠标滚轮浏览全部 Frame；修复 stack flip 后暂时无法绘图；为同名 Frame 自动编号并统一右键和菜单改名。
- 范围：侧栏列表滚动与状态更新、Viewer 缓存预览过渡期的绘图逻辑、Frame 显示标题。
- 步骤：检查侧栏高度和滚轮事件；检查 flip 后缓存图像重建流程；统一标题命名与改名入口；在远程 Cursor 和相关测试中验证。
- 验证：多个 Frame 列表滚动、stack flip 后即时显示与交互、同名 Frame 编号与改名、静态检查和相关测试。

## 实施记录

- Layout 的 Frame 列表原本只有 CSS 溢出设置；为其加入明确的滚轮处理，并在侧栏状态重建列表时恢复 `scrollTop`。保留独立列表滚动和可见的窄滚动条。
- stack 原位 flip 会保留原始像素缓存，把已绘制画布暂时置空，随后异步重着色。此前 `draw()` 在这段过渡期对空图像调用 `drawImage`，导致异常并中断随后的绘制调度；现在空画布会跳过，等待重着色完成后正常绘制。
- 同名 Frame 显示标题由第二个起加 `(2)`、`(3)` 等后缀。Layout Frame 行右键增加 Rename；它与图像右键和 Image > Rename 共用同一操作，只修改内存中的 Frame 标题，不重命名磁盘源文件。
- 远程后端使用真实的 101 帧 TIFF stack 验证水平翻转后仍是 101 帧，并可立即读取渲染首帧；生成的临时 TIFF 已删除。`0.6.8` 安装至本地及远程 Cursor。

## 总结

- 完成 Layout 滚轮、flip 绘图过渡期、Frame 自动编号和统一改名。
- `npm run check`、12 个 Node 测试、25 个 Python 测试及 VSIX 打包通过。远程后端真实 stack 的翻转与读取通过。
- 保留用户当前远程 Cursor 的多 Frame 会话，因此没有重载该窗口；新版本的 Webview UI 行为需要在该窗口重载后验证，重载会丢失当前仅在内存中的 Frame 布局与参数。
