# B&C 切换、tile pan 与 Orthogonal Views

## 计划

- 目标：ADJUST 增加 B&C 显隐按钮；修复 tile pan 的鼠标像素比例；为单帧 stack 提供同步 XY、YZ、XZ 正交视图。
- 范围：侧栏状态与操作、viewer canvas 交互及布局、后端横截面读取、针对轴和数值的测试。
- 步骤：定位现有状态与绘图换算；实现后端横截面和三视图前端；按 ImageJ 正交视图交互验证；在远程 Cursor 测试。
- 验证：Node 静态检查与测试、Python 真实 stack 测试、VSIX 打包、远程 Cursor 交互。

## 实施记录

- ImageJ 官方指南描述了 XY、XZ、YZ 三视图，以及可在任一视图拖动交点、切片变化时同步更新的操作。
- 后端按当前 stack 轴读取 XZ、YZ 原始像素；四维数据保持其他轴的当前位置。侧视图使用当前 B&C/LUT 着色，拖动、点击、滚轮和切片工具栏同步十字线。
- tile 绘图和 pan 坐标换算共用同一个每像素显示比例。ADJUST 的 B&C 按钮切换图窗的 `hidden` 状态。

## 总结

- 完成 B&C 显隐、tile pan 比例修复和单帧 stack 的三视图正交浏览。tile 模式下正交功能会提示需要切换到 single。
- 验证：`npm run check`、12 项 Node 测试、26 项 Python 测试、`git diff --check`、VSIX 打包均通过。独立远程 Cursor 窗口验证了三视图显示、XY/XZ/YZ 点击同步、slice 切换及 B&C 隐藏/恢复。tile 拖动由共用比例公式修复，未进行自动化鼠标拖动量测。
- 安装了本地与 `hyh-batchcom2` 的 0.6.10 开发版；远程独立测试窗口和本地/远端测试 TIFF 均已清理。大型 stack 的正交截面需逐层读取，首次显示可能需要等待。
