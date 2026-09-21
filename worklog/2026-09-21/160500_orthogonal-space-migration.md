# Orthogonal Space 手势设置迁移

## 计划

- 检查新版默认值未生效的原因。
- 将已保存的旧 `shift+click` 值迁移为 `space+click`，保留同一设置对象中的其他鼠标绑定。
- 确保迁移异步完成前，新打开的 viewer 也立即使用 Space 手势。
- 运行检查和测试，打包后安装本地、hyh-batchcom2、ssk-CAST，并推送 GitHub。

## 实施记录

- 根因是 Cursor 用户、工作区或工作区文件夹设置的旧值优先级高于扩展新版默认值。
- 激活扩展时检查三个设置层级，仅当 `orthogonalTool` 恰好为旧默认 `shift+click` 时改为 `space+click`，其余自定义鼠标绑定保持不变。
- viewer 初始化时也会将尚未落盘完成的旧值规范化为 `space+click`。
