# vivi

vivi 是面向 Cursor / VS Code 的文件与数据查看扩展。目前提供图像查看器，支持 PNG、JPEG、TIFF、FITS 等格式，以及基础视频预览。连接 Remote SSH 时，文件由远端 Python 解码，编辑器接收预览图，适合快速浏览服务器上的大图。

## 功能

- 从侧栏 Explorer 浏览当前主机上的任意可访问路径。双击文件在 vivi 中打开；右键可选择在新标签页打开。
- 使用 `vivi.managedExtensions` 设置由 vivi 接管的文件扩展名；其他文件交给编辑器默认打开方式。
- 浏览 TIFF stack、hyperstack 和 FITS 多 HDU；切片预览在后台缓存。
- 在同一标签页内管理多个文件 Frame，支持单帧、平铺、切换，以及 B&C、色彩、视野、缩放和切片的独立锁定。
- 提供基础选区、测量、直方图、线剖面、色阶调整和 Montage。源文件以只读方式打开。

菜单中标为 **Planned** 的命令尚未实现。

## 安装

在运行扩展的主机上准备 Python 3.10+，安装依赖并打包扩展：

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
pnpm install
pnpm run package
```

在 Cursor / VS Code 中通过 **Install from VSIX…** 安装生成的 `vivi-*.vsix`。使用 Remote SSH 时，还需在远端扩展主机安装。将设置 `vivi.pythonPath` 指向该主机的 Python 解释器；然后运行 **vivi: Check Python Backend** 检查依赖。

## 开发与测试

```bash
pnpm run check
pnpm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v
```

`tests/fixtures/` 存放固定回归样本，可用 `tests/generate_fixtures.py` 重新生成。新格式入口位于 `src/formats.js`。

## 许可

MIT，见 [LICENSE](LICENSE)。
