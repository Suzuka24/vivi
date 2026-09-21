# LAYOUT 控件与 Slice 按键修复

## 计划

- 统一 LAYOUT 第一行 Frame 上移、下移、显示模式、Columns、Rows 五个控件的高度和垂直对齐。
- 修复 slice 左右按钮短按可能跨越多帧的问题，同时保留按 FPS 连续长按播放。
- 运行静态检查、Node 与 Python 测试，打包 0.7.13，安装至本地及两台远程 Cursor，提交并推送远端仓库。

## 实施记录

- 以显示模式控件所在行的 27 px 高度统一五个控件，并统一 `inline-flex` 居中方式。
- 查看器工具栏和 LAYOUT 侧栏的 slice 左右按钮采用一致行为：按下后等待 300 ms；在阈值内松开只切换一帧，超过阈值后才按当前 FPS 连续切换。鼠标产生的后续 `click` 事件不会重复触发切换。
- 版本更新至 0.7.13。

## 验证方式

- `npm run check`
- `npm test`
- `./.venv-local/bin/python3 -m unittest discover -s tests -p 'test_*.py' -q`
- `npm run package`
- 三端安装后核对版本号与核心文件 SHA-256。

## 验证结果

- 静态检查通过。
- Node 测试 23/23 通过。
- Python 测试 45/45 通过，仅出现 tifffile/NumPy 上游弃用警告。
- `npm run package` 生成 `vivi-0.7.13.vsix`。
- 本地、hyh-batchcom2、ssk-CAST 三个 Cursor 均已安装 0.7.13。
- 三端 `media/viewer.js` SHA-256 均为 `fd308c54eaf3fa722b3ca3fe6cb67b1a452a8bb463c4c5533abc7b0b87e742f1`；`media/explorer.js` 与 `media/explorer.css` 的哈希也分别一致。
- 两台远程主机的临时 VSIX 已删除。

## 总结

LAYOUT 顶行五个控件已统一为 27 px 并居中对齐。两个 slice 控制入口都采用 300 ms 长按阈值，普通点击只切换一帧，长按按 FPS 连续切换。版本 0.7.13 已完成测试、打包和三端部署。
