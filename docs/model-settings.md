# 模型配置弹窗

用户要求把旧的页面内配置说明改为居中弹窗，参考 ZCode 的模型设置。沿用 WindGen 已确认的暖纸面、炭黑、雾蓝配色。

参考：[ZCode 官方连接模型文档](https://zcode.z.ai/cn/docs/configuration) 与其中的[DeepSeek 自定义供应商截图](https://zcode.z.ai/content/docs/v2/screenshots/apikey-custom-deepseek-20260728.webp)。借鉴供应商导航和连接字段的组织方式；本 MVP 管理一个当前模型连接，支持 DeepSeek 或自定义 OpenAI 兼容接口。

- 桌面：居中浮层，左侧服务导航，右侧连接表单，底部测试与保存操作。
- 手机：服务导航变为横向选择，表单可滚动；对话内容保留在遮罩下。
- 表单：接口基础地址、固定的 OpenAI 兼容格式、新 API Key、模型 ID。
- 已有密钥不回传到页面；同一地址留空保留，切换地址需要该服务的密钥。
- 测试连接查询模型列表，不保存草稿，不生成教程；HTTP 错误仅显示明确状态和恢复建议。
- 保存原子写入本机 `.env`，权限为 0600，保留其他配置；成功后立即用于后续生成。
- Radix Dialog 提供焦点约束、Escape 关闭与遮罩；关闭恢复入口焦点。请求期间禁止重复操作与关闭，避免误解保存结果。

验证：新增 8 项 Python 配置测试，覆盖持久化、密钥保留、切换服务、即时生成配置、写入失败、来源校验和连接错误；新增 2 项浏览器测试，覆盖桌面居中、手机无溢出、焦点、草稿取消、密钥显隐、错误反馈和保存。


## Appearance settings

The general settings dialog provides light/dark mode and six muted accent choices: mist blue, ink blue, lavender, rose, terracotta, and amber. Appearance preferences persist in browser local storage and apply immediately.
