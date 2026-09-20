# 计划

目标：将 hyh-batchcom2 的 Cursor 中 vivi 生效设置转为可移植的默认值；开放 Frame 前后切换与显示模式切换快捷键；取消固定 Shift+加减缩放；评估科学 stack 的有损传输。

范围：设置声明、viewer 快捷键分发、用户文档、版本与更新记录。研究有损压缩方案，但不引入有损传输代码。

步骤：核对 Cursor 当前设置与冲突；修改默认值及按键分发；运行 JS 静态检查、单元测试和打包；在远程 Cursor 验证；更新已授权的安装与远端仓库；总结压缩取舍。

验证：配置声明和运行时默认值一致；缩放与切片、Frame、模式按键行为符合预期；现有测试通过。

# 实施记录

- 当前用户配置：`zoomIn =`、`zoomOut -`、左右方向键切片、`oval c`、`pointer shift+p`、`maxDecodedPixels 256000000`；撤销和重做均为 `z`，存在冲突。
- `pythonPath` 指向本机虚拟环境绝对路径，`defaultPath` 指向 hyh 专用目录，暂保留跨机器的现有默认值，避免其他主机不可用。
- 用远程 101×795×795 float32 TIFF 的 3 帧样本进行内存内量化与无损压缩大小基准，不写测试数据到 `/tmp`。

# 总结

待完成。

## 有损传输探索

测试输入：hyh-batchcom2 上 101×795×795 的 float32 TIFF，从第 1、51、101 帧取样；原始单帧 2,528,100 B。只比较服务端内存中的编码后字节量和量化误差，尚未测量网络往返、浏览器解码、总吞吐。三帧的结果范围：

| 方案 | 编码后每帧大小（byte shuffle + zlib level 1） | 最大绝对误差 | RMSE / 各帧动态范围 |
| --- | ---: | ---: | ---: |
| 原 float32 无损 | 1,665,574–2,021,133 B | 0 | 0 |
| float16 | 698,376–950,401 B | 3.03e-5–2.43e-4 | 5.82e-6–1.99e-5 |
| bfloat16 | 400,818–757,567 B | 2.43e-4–1.877e-3 | 4.66e-5–1.6e-4 |
| 每帧线性 uint8 | 122,695–159,509 B | 1.61e-4–1.81e-3 | 0.00113–0.00117 |

逐帧 uint8 的离群最大值会扩大步长，可能抹去暗部细节。float16 与 bfloat16 均不能保持源值完全一致。下一步应以 zfp fixed accuracy、SZ3 的可控误差模式和分块 12/16-bit 线性量化做端到端传输基准，并测最大绝对/相对误差、背景噪声和低亮度结构；有损模式应由用户明确启用，只用于预览。当前请求只讨论，未实现有损编码。

资料：https://zfp.readthedocs.io/en/release1.0.0/modes.html 、https://github.com/szcompressor/SZ3 、https://docs.amd.com/r/en-US/68552-AOCL-api-guide/BFloat16-Format 。

# 总结

- 修改了扩展清单和 viewer 快捷键分发：`=` / `-` 缩放、左右方向键换切片、上下方向键换 Frame、`m` 切换 Single/Tile；Shift+加减不再硬编码，解绑后不触发；`m` 不再同时绑定 Measure。
- 把 maxDecodedPixels 默认值改为 256,000,000；将当前快捷键里可移植的自定义设置设为默认。撤销/重做同时绑定 `z` 的冲突采用 `z` / `shift+z` 的不同默认值。机器专用 Python 路径与 hyh 专用初始目录维持原有可移植默认值。
- `npm run check` 和 `npm test` 通过，共 15 项 JS 测试；`npm run package` 成功。Cursor 中在 hyh-batchcom2 重载后可看到新增设置项及其默认值。本机、hyh-batchcom2、ssk-CAST 安装 0.6.21，两个远程包 SHA-256 均与本机 VSIX 一致。
- 未完成：有损压缩未编码，需先确定可接受误差并做端到端吞吐测试。现有用户级 `redoTransform=z` 若保留，会覆盖新默认值并与撤销冲突，需要将该用户项重置或改为 `shift+z`。
