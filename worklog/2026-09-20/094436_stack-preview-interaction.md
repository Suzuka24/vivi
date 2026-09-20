# Stack 与预览交互

## 计划

- 目标：Layout 可滚动；B&C 与 Auto 立即同步；已载入 slice 在 ADJUST 或原位变换后复用像素；文件夹图像序列成为带文件名的 stack；按维度显示第二行工具栏；支持任意缩放百分比及 Shift+加减快捷键。
- 范围：Viewer、Explorer、扩展宿主、Python 图像源与相关测试。
- 步骤：拆开像素和显示缓存；加入序列数据源及导入入口；修改布局和快捷键；打包并优先在远程 Cursor 验证。
- 验证：Node/Python 测试、真实 TIFF 与文件夹序列操作、远程及本地安装。

## 实施记录

- 图像预览改为保留原始像素，B&C、LUT、stretch、invert 与 threshold 在 Webview 中重新着色，不再因显示参数变化清空预览缓存；常见翻转和 90° 旋转会同步变换已有缓存。
- 增加懒加载的文件夹 Image Sequence 数据源，按自然顺序排列文件并在 slice 栏显示源文件名；File > Import 和 Explorer 文件夹入口均可导入。
- Layout 增加内部纵向滚动；二维图隐藏 slice 行，四轴图可选择第三或第四轴；缩放百分比可直接输入，Shift 加号/减号切换缩放级别。
- 远程 Cursor 初次安装后发现显示模块与查看器脚本的全局名称冲突，修复为独立作用域，并增加启动错误提示。
- 使用远程真实 TIFF、三张 PNG 的临时文件夹和四轴 FITS 验证；临时文件与远程 VSIX 安装包已删除。

## 总结

- 已完成上述交互和缓存改动。远程 Cursor 验证二维图隐藏 slice 行、文件夹 stack 按 `slice_1 / slice_2 / slice_10` 排序并显示名称、Auto 后 B&C 更新且 3/3 预览保留、四轴 FITS 可切换第三和第四轴、tile 选择二维/四轴 Frame 时切片行随之隐藏/显示、任意 125% 缩放输入。
- 验证：`npm run check`、`npm test`（10 项）、Python unittest（25 项）、VSIX 打包；0.6.6 已安装在本地与远程 Cursor。
- 预览缓存仍受 `vivi.preloadMaxMiB` 内存上限约束；超过上限的未缓存切片需要再次读取。大图的局部预览在视野改变后也可能请求新区域。
