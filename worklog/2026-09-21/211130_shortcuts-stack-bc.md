# 快捷键与整栈 B&C

## 计划

- 更新默认快捷键及设置说明，并让 Explorer、Layout、图像视图和 Adjust 视图响应对应快捷键。
- 在 Adjust 中增加 S-Auto、S-Reset，按当前选定三维 stack 计算 B&C；高维数据固定其他轴坐标。
- 统一五个 Adjust 操作按钮的高度与间距。
- 运行 JavaScript、Python 测试和扩展打包，再提交、推送并安装到三个 Cursor 环境。

## 实施记录

- 将 Oval、Clear Selection、Play、Auto、Reset、S-Auto、S-Reset、Rename 的默认键位分别设为 O、C、Enter、A、S、Shift+A、Shift+S、F2。
- 清除 Redo 的默认键位，保留 Z 仅用于 Undo。
- S-Auto 对当前三维 stack 做全栈抽样百分位统计；S-Reset 精确遍历当前三维 stack。二维图退化为现有 Auto/Reset。
- 新增高维轴索引测试，验证只遍历当前选择的三维 stack。

## 总结

待验证、打包、安装和推送后补充。

## 验证结果

- `npm run check` 通过。
- Node 测试 24/24 通过，包括新增的高维 stack 轴索引测试。
- `.venv-local/bin/python -m unittest discover -s tests -p 'test_*.py' -v` 通过，45/45；仅有 tifffile/NumPy 上游弃用警告。系统 Python 因缺少项目运行依赖不作为有效测试环境。
- `npm run package` 成功生成 `vivi-0.7.14.vsix`。
- 本地、hyh-batchcom2、ssk-CAST 均已安装 0.7.14；三端 viewer.js、explorer.js、explorer.css 的 SHA-256 完全一致。
- 两台远程主机的临时 VSIX 已删除。

## 总结

默认快捷键、Explorer/Layout 的 F2 重命名、ADJUST 的五按钮布局，以及按当前三维 stack 计算的 S-Auto/S-Reset 已完成。二维图会使用原有 Auto/Reset 行为；高维图只遍历当前选中轴构成的三维 stack。版本 0.7.14 已完成测试、打包和三端部署。
