# 侧栏、四轴切片与 B&C 调整

## 计划

- 目标：按反馈修复 vivi 工具栏重叠、四轴 FITS 切片、B&C 滑块和结果窗口布局。
- 范围：原生侧栏视图、Viewer/Explorer Webview、四轴回归样例和本地安装包。暂不发布商店。
- 步骤：拆分视图；实现轴坐标映射；修正滑块计算及曲线显示；收紧窗口与错误提示；在固定文件上回归并打开 Cursor 检查。
- 验证：Node 静态检查与单元测试、Python 图片回归、VSIX 打包以及 Cursor 本地实际打开 FITS。

## 实施记录

- 注册 Explorer、Layout、Adjust 三个原生 WebviewView；共享当前 Viewer 的侧栏状态，每个视图只展示自身控件。
- 将 Series/切片控件排在工具栏第二行；对 FITS 非空间轴分别显示第三轴和第四轴，并在切轴和拖动切片时保留另一轴坐标。
- B&C 的四个滑块按稳定初始范围映射亮度中心和对比度宽度；去除 range 的通用输入框 padding；独立固定右下角的可最小化曲线，并绘制当前切片采样直方图。
- 结果窗口的统计值缩短；调整直方图窗口、画布和长标题布局；错误文案至少保留 2.5 秒。Filter 改为工具栏按钮。
- 加入 `tests/fixtures/four-axis.fits` 与像素值回归。

## 总结

- 完成上述内容，打包 `vivi-0.6.2.vsix` 并在本地 Cursor 安装；看到三个原生一级模块、FITS Viewer 的新工具栏和四轴选择框。仅为本地开发安装，没有发布商店。
- `npm run check`、`npm test`（7 项）、Python 回归（24 项）和 `npm run package` 全部通过。
- 远端 hyh-batchcom2 仍运行其原先的开发版，本轮未部署新版到远端；远端 UI 的实际交互需在部署后复核。
