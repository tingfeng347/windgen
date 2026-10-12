# 渐进教程生成修复（2026-10-12）

## 问题与复现

- 每 20ms 收到一段 SSE 文档时，界面仍停在等待状态。`Lesson` 每次更新都取消并重建 90ms 防抖计时器，连续流让编译一直被推迟。
- 本地失败记录的 DIL 长度为 0。对当前 DeepSeek 配置进行受限请求验证，得到 `finish_reason=length`、1,072 个思考字符和 0 个正文字符。默认思考阶段会占用输出预算。
- SSE 无终结事件就关闭时，前端未将版本从 streaming 改为错误；CRLF 跨片段拆分也会导致事件混在一起。

## 重读参考源码

- [server/http/chat.js](https://github.com/Disdjj/intelligent-ui-demo/blob/main/replica/server/http/chat.js)：`createCompileLoop.append()` 根据时间或累计字符阈值触发编译；constants、appData 先于 code 发送。
- [server/agent/llm.js](https://github.com/Disdjj/intelligent-ui-demo/blob/main/replica/server/agent/llm.js)：正文与思考分开处理，支持关闭思考，思考只报告进度。
- [public/dil/message-view.js](https://github.com/Disdjj/intelligent-ui-demo/blob/main/replica/public/dil/message-view.js)：代码到达后立即交给沙箱，中途错误保留最后一个成功界面。
- [DeepSeek 官方 thinking 参数](https://api-docs.deepseek.com/guides/thinking_mode/)：官方接口支持 `thinking.type=disabled`。

## 实现

保留模型 content → Python SSE → 浏览器编译 Worker → 隔离计算 Worker → 宿主组件链路，无需等待整段源码完整。

- 用 70ms / 320 字符阈值替代尾部防抖。编译与沙箱程序更新串行执行；忙时只保留最新源码，不无限累积任务，也不反复丢弃处理中结果。
- 不完整片段产生错误或空树时保留已有界面；流结束后展示仍存在的运行错误。失败且没有正文时停止加载指示。
- DeepSeek 官方域名请求禁用 thinking；普通 OpenAI 兼容接口不附加厂商参数。提示词要求先输出标题和简短说明，再逐步输出公式与控件。
- 异常关闭标记为错误并保留已收到内容；CRLF 在累计缓冲区中归一化，兼容换行跨包拆分。

## 验证

- `e2e/streaming.spec.ts`：每 20ms 到达的持续流，1.5 秒内显示标题且尚未结束；无正文失败后没有永久加载指示。
- `src/lib/api.test.ts`：跨包 CRLF 和无终结事件的断线。
- `tests/test_provider.py`：DeepSeek 官方请求禁用思考，自定义接口保持通用请求体。
- 真实 BLIP-2 请求：首次正文 0.87 秒，5,235 字符在 11.05 秒完整返回。
- 真实浏览器/后端：BLIP-2 在 2.878 秒开始显示，此时仍在生成；9.346 秒完成，有 2 个滑块，单步后为 `1 / 4`，页面与运行错误均为空。

时间是本次本机实测，不代表延迟保证。测试截图与模型输出位于已忽略的 `data/diagnostics/`；凭据不进入测试日志或源码。

## 旧页面加载失效 Worker（2026-10-12）

实际页面请求 `/assets/worker-AKM08rT9.js`，生产构建已替换该哈希文件，HTTP 返回 404。相同 2,337 字符注意力样例独立编译约 32ms；故障属于旧页面引用失效资源。Worker 加载错误未清除解析定时器，3 秒后被覆盖成「文档解析超时」，局部「重新加载」仍使用旧入口，不能恢复。

- Worker 启动先发 ready 握手；启动等待上限 5 秒，收到 ready 后才开始单次解析的 3 秒预算。
- 加载错误清理计时器、停止队列，明确提示刷新页面；该按钮刷新整个页面以获取新入口。实际解析超时仍终止 Worker，保持执行限制。
- 后端 HTML 使用 `Cache-Control: no-store`，assets 使用 `no-cache` 重新验证；已打开的旧页面仍须刷新获取新构建。
- `e2e/parser-timeout.spec.ts` 在生产端口回放注意力样例、阻断 Worker 返回 404、延迟启动 3.5 秒。修复前 404 用例失败并复现错误被覆盖，修复后全部通过；流式与完整 Transformer 回归一并通过。
