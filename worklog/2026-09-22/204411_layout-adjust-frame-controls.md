# vivi Layout 与 Adjust 更新

## 计划

- 目标：调整 Adjust 与 Layout 控件布局，增加 Frame 排序按钮和可配置快捷键，合并锁定选项，并修复 stack 切片下 Adjust 范围错误。
- 范围：`media/` 的三个 webview 前端、`src/extension.js` 的 sidebar/viewer 同步、`package.json` 的快捷键设置，及直接相关测试和文档/版本记录。
- 关键步骤：梳理 Frame 顺序与状态同步；实现排序命令及跨焦点快捷键；调整 Layout/Adjust CSS；迁移组合锁语义；让 Adjust 范围随当前切片统计值更新；补充回归测试。
- 验证：运行 JavaScript 语法检查与 Node 测试、Python 测试、VSIX 打包和安装后端 smoke test；检查 git diff；推送 GitHub 后在本机、`hyh-batchcom2`、`ssk-CAST` 三个 Cursor 安装同一 VSIX 并核对版本。

## 实施记录

- 2026-09-22 20:44：确认 `main` 工作区干净，当前 HEAD 为 `c5124ed`；开始梳理 Layout、Adjust、viewer 和 extension host 消息链路。
- 定位 Adjust bug：`displayBounds` 只以 Frame 与 dataset 为键，导致 stack 第一张 slice 的范围被后续 slice 复用；现改为 Frame、dataset、slice 三级键，并优先使用当前 slice 的直方图范围。
- Layout 顶部增加上移、下移、置顶、置底按钮；共用 `reorderedEntries` 顺序变换，新增扩展级命令及默认 Shift/Ctrl + Up/Down 键位。
- Layout webview 补齐 Up/Down Frame 切换；扩展级排序命令通过 `vivi.sessionActive` 上下文在普通编辑区也可调用，并可由 Cursor Keyboard Shortcuts 修改。
- 合并锁组：B&C 同步 cuts、范围、stretch、LUT、invert、threshold；View 同步中心点与 zoom。Layout 与 viewer 隐藏的锁控件保持同一语义。
- 调整 Adjust 最后一行和 Layout 工具行样式，保持按钮/输入框高度一致，并增加工具行与 Frame 列表间距。
- 版本更新到 `0.7.15`，同步中英文 README、usage 和 changelog。
- 验证：JavaScript 语法检查通过；Node 26 项测试通过；Python 45 项测试通过；`vivi-0.7.15.vsix` 打包成功（50 files，303.21 KB）。
- 源码提交 `6485f03` 已推送到 `origin/main`。
- 同一份 `vivi-0.7.15.vsix` 已安装到本机 Cursor、`hyh-batchcom2` Cursor Server、`ssk-CAST` Cursor Server；三处均核对为 `suzuka24.vivi@0.7.15`。本机安装包中的 Python worker diagnostics 通过，依赖无缺失；远端临时 VSIX 已清理。

## 总结

- 已完成 Layout 排序控件与全局排序命令、Layout Frame 导航快捷键、锁组语义合并、Adjust 控件排版和 stack 当前 slice 范围修复。
- 全部自动化验证通过，源码已推送，三台 Cursor 已更新到 `0.7.15`。
- 未完成事项：按用户要求未操控 Cursor 做界面交互测试；实际 UI 外观与交互由用户打开 Cursor 后验收。
- 剩余风险：窄侧栏下 Layout 第一行会横向滚动以保持所有控件同一行；全局 Frame 排序键仅在存在 vivi session 时接管 Shift/Ctrl + Up/Down。
