# 正交视图与图像工作流改进

## 计划

- 目标：调整正交三视图的方向和几何对齐，并完善复制、旋转、文件夹 stack、Explorer、Layout 与快捷键入口。
- 范围：前端 viewer/Explorer、extension host、图像后端、设置及回归测试。
- 步骤：实现三视图坐标和缓存同步；接入截面复制与工具栏；实现任意角度旋转；扩展文件夹读取；调整侧栏操作及快捷键。
- 验证：Node/Python 测试、打包、远程 Cursor 独立窗口交互验证，检查最终差异。

## 实施记录

- 参考 ImageJ 官方 Rotate 菜单说明和 Rotator 源码确定旋转角度、插值、网格、背景填充、放大画布和 Preview 选项。
- 修改正交截面的后端轴顺序和前端布局，让 YZ 的横轴为 Z、纵轴为 Y；切片缓存齐备时由前端直接更新截面。
- 为 XZ/YZ 添加复制成独立 2D Frame 的后端操作，并补齐工具栏、任意角度 Rotate 对话框和撤销链。
- 文件夹 Stack 增加 2D/all 模式及源切片标签；复制 Frame 保留该读取模式。调整 Explorer 删除、布局菜单与快捷键设置。
- 更新中英文 README 与使用指南，并将 worklog 排除在 VSIX 之外。

## 总结

- 完成正交视图方向与贴边排布、工具栏入口、截面复制、任意角度旋转预览、混合文件夹 Stack、源切片标识、Layout 复制/删除、Explorer 永久删除与快捷键设置。
- 本地验证：`npm run check`、`npm test`（12 项）、Python unittest（28 项）、`git diff --check`、VSIX 打包均通过。
- 远程验证：在 `hyh-batchcom2` 的独立 Cursor 窗口打开真实 101 层 TIFF；确认新增工具栏、XY/XZ/YZ 的排布和方向、点击 YZ 后主图切片同步，以及 Rotate 预览窗口。远程 Python smoke test 验证 2D/all 文件夹模式、切片标签与旋转。测试用远程临时目录已删除。
- 剩余限制：大型 stack 的未缓存切片仍需远程读取；因此切到尚未预载的切片时可能短暂显示空白，随后补上图像。本次没有在 GUI 中对右键截面复制、递归删除或 101 层 stack 的任意角度旋转执行破坏性操作；相应后端路径通过自动测试覆盖。
