# 快捷键与 Orthogonal Selection 同步

## 计划

- 更新 Pointer、Rectangle、Oval、Measure、Frame display 的默认快捷键。
- 将 Orthogonal Views 中启用当前工具的手势从 Shift+鼠标改为 Space+鼠标。
- 修复 tile + orthogonal + selection lock 时非当前 frame 不显示同步选区的问题，并确认其他锁定行为仍复用普通 tile 的同步状态。
- 完成静态检查、Node/Python 测试和打包，安装到本地、hyh-batchcom2、ssk-CAST，提交并推送 GitHub。
- 对照 ImageJ 源码分析相同数据量下的传输与加载策略，不修改传输实现。

## 实施记录

- 已定位到 Selection lock 会正确复制选区；orthogonal tile 的非当前 frame 绘制分支遗漏了 selection overlay。
- 已补充 orthogonal XY 区域的同步选区绘制，并接入相同的 `scale/cx/cy` 布局。
- 已增加 Space 键状态跟踪，Orthogonal Views 中默认使用 `space+click` 才进入当前工具操作，否则保持十字线操作。
- 默认快捷键更新为 Pointer=P、Rectangle=R、Oval=C、Measure=M、Frame display=D。
- `npm run check`、21 项 Node 测试和 44 项 Python 测试均通过。
