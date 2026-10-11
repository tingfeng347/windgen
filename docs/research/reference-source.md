# intelligent-ui-demo 源码研究：WindGen MVP 的参考边界

研究日期：2026-10-11。主任务已定位目标仓库 `/Users/alice/code/windgen`，本文放在该仓库的 `docs/research/`。本文只做研究，不引入业务实现或 Spec 流程。

参考仓库：[`Disdjj/intelligent-ui-demo`](https://github.com/Disdjj/intelligent-ui-demo)。本次只读取文档、源代码和测试，未安装依赖、运行服务或执行模型代码；固定快照为 [`33297b8629c82fa5b7cc15dcd157ce90821463f3`](https://github.com/Disdjj/intelligent-ui-demo/tree/33297b8629c82fa5b7cc15dcd157ce90821463f3)。外部仓库只读克隆到 `~/.x-repo/github.com/Disdjj/intelligent-ui-demo`；当前环境未发现 `x` 命令或 `~/.x-cmd.root/X`。

## 结论与事实等级

值得复刻的体验是“回答本身变成可操作的小工具”：模型生成界面及计算逻辑，交互在浏览器中即时执行，宿主负责统一组件及样式；用户操作形成有语义的状态，后续对话能够读到。这与生成任意网页再在 iframe 展示有不同的执行和渲染边界。参考实现的具体路径是 DIL 源码 → 编译后的 JavaScript → 隔离 Worker 求值得到元素树 → 宿主渲染。依据：[编译入口](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/compiler/index.js)、[消息视图](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/public/dil/message-view.js)、[宿主渲染器](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/public/dil/renderer/index.js)。

以下三类信息必须区分：

| 类别 | 本次可以说什么 | 限制 |
| --- | --- | --- |
| 可直接读取的复刻代码 | 服务如何请求模型、编译、传输、执行、渲染及保存状态 | 这是独立项目实现，不是 OpenAI 官方代码 |
| 作者报告的抓包观察 | 文档、脱敏 artifacts 和 captures 展示的一次运行协议及编译结果 | 样本来自一个账号的一次完整生成，不能推出全部 ChatGPT 模式 |
| 作者重建或推断 | 系统提示词、服务端编译器内部、状态如何放进下一轮模型上下文 | 本仓库明确承认这些没有直接抓包证据 |

尤其应避免把“DIL 是 ChatGPT 已公开稳定 API”“本仓库拿到了 ChatGPT 的完整编译器”写进产品文档。仓库说明未分发 OpenAI 的 runner bundle、iframe 文档或宿主 chunk；博客第 16 节还区分了观察、推断和复刻新增容错。依据：[仓库声明](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/README.md)、[博客的证据边界](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/BLOG.zh-CN.md#16-哪些是确定的哪些是推断)。

## 模型实际输出什么

模型输出原始 **DIL 文档**，不是 TSX 文件、React 项目、完整 HTML，也不是组件 JSON。文档组合普通 Markdown、`{@body ...}` 内的 JavaScript、受控 JSX 风格标签、`{expr}`、`{#if}` 和 `{#each}`。系统提示要求短说明、状态与数据声明、一个根 `<box>`，不包 Markdown 代码围栏。状态写成 `const [amount,setAmount] = DIL.useState(100)`。模型不导入 React、shadcn/ui 或 npm 包。依据：[重建系统提示词](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/agent/system-prompt.js)、[真实样本 DIL](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/artifacts/genui-source.dil.md)。

前端使用 TypeScript 与 shadcn/ui 可以实现同样模式：让宿主 React 渲染器将协议中的 `slider`、`select`、`button` 等映射到固定组件；模型只知道协议中的组件和属性。宿主的 TypeScript 技术栈与模型输出语言是两项独立决定。此项是面向 WindGen 的设计建议，不是参考仓库已经采用的方案。

## 一轮请求与事件序列

1. `DilMessageView.run()` 先创建隐藏 iframe，设置 `sandbox="allow-scripts"`，不加 `allow-same-origin`；宿主等 iframe 的 `ready`，再开 EventSource。初次 iframe 启动有 5 秒预算。依据：[sandbox 客户端](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/public/dil/sandbox.js)、[消息视图 run](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/public/dil/message-view.js#L122)。
2. 浏览器 `GET /api/chat?q=...&conversation_id=...`。服务取该会话状态快照，将用户修改过的快照整理为文本上下文。服务发送 SSE `meta`（会话、消息、模型、协议版本），再发 `note`。依据：[HTTP chat](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/http/chat.js#L124)、[stream 客户端](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/public/dil/stream.js)。
3. 没有模型配置时用 mock 重放 DIL；配置 `DIL_LLM_BASE_URL` 和 `DIL_LLM_API_KEY` 时向 `{baseUrl}/chat/completions` 发 `POST`，设置 `stream:true`、temperature 0.6、system prompt、可选状态 system 消息和当前 user 问题。模型并没有收到历史 user/assistant 消息列表。依据：[LLM 请求体](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/agent/llm.js#L14)、[agent 选择](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/agent/index.js)。
4. `reasoning_content` 只累计字符并发 `thinking` 进度，不当成 DIL，也不直接展示推理正文。`delta.content` 作为 DIL chunk 追加至 `/message/content/parts/0`。默认满足经过约 70ms **或**新增源码长度至少 320 时重编译；所谓 bytes 实际使用 JS 字符串 `length`，不能当 UTF-8 字节计量。依据：[LLM 流解析](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/agent/llm.js#L64)、[重编译循环](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/http/chat.js#L88)。
5. 一次编译按序发送 constants、appData、fallbackMarkdown、diagnostics、requiredComponents、stats，然后 code；客户端在 code 到达时立即执行，因此它依赖的数据必须先到。各条均是 `event:delta` 加 `{p,o,v}`。编译代码全量 replace，并非 JS 增量 diff。随后发送 `genui_components` 的源码区间补丁。依据：[compilePatches](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/http/chat.js#L31)、[组件区间补丁](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/compiler/genui-components.js)。
6. 初次程序触发 `createRunner`，之后触发 `setCompiledDil`。宿主与 iframe 用 `window.postMessage`；iframe 与 Worker 使用 control/data 两个 MessageChannel，事件 trigger 还会走 Worker 全局消息入口。Worker 执行编译 JS，序列化输出 `{t,p,c}` 元素树；函数属性变为 `{"__dilFn":"fnN"}`。依据：[frame 通信](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/sandbox/frame.js)、[Worker 运行时与序列化](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/sandbox/worker.js#L187)。
7. 宿主固定组件字典把树渲染为 DOM。用户输入只回传函数 id 与值，Worker 调 setter、重算派生值、输出新树；此轮浏览器交互不请求 LLM。DOM patch 按子节点索引和组件类型复用节点，因此普通更新能保留输入焦点，但不是完整 keyed reconciliation。依据：[DOM patch 与事件映射](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/public/dil/renderer/patch.js)、[Worker invoke](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/sandbox/worker.js#L294)。
8. keyed 状态变化输出 `stateChanged`；前端默认 600ms 合并最新状态，POST `/api/conversation/{cid}/message/{mid}/dil/view_state`，带 `client_session_id`、scope、state、`client_update_id`。服务内存存储、按 update id 去重；首次上报是 baseline，后续不同值标记 user_modified。下一次请求把修改过的快照喂给模型。依据：[前端上报器](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/public/dil/view-state.js)、[服务状态存储](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/view-state.js)。
9. 模型流结束后强制最后一次编译，发送 status、durationMs、`message_stream_complete`，最后 `data:[DONE]` 并关闭。复刻断线直接结束，没有博客描述的 resume/offset 实现。依据：[结束流程](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/http/chat.js#L166)、[客户端断线处理](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/public/dil/stream.js#L99)。

这不是标准 RFC 6902 JSON Patch：字段是 `p/o/v`，另有字符串 `append` 运算和约定路径；它也没有实现 AG-UI 标准事件。迁移时应明确称为项目自身的事件协议。依据：[applyPatch](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/public/dil/stream.js#L27)。

## 编译器、运行时、组件的实现分工

编译器做恢复解析、Markdown 降低、状态声明重写、表达式保护、常量提取、图表 shim、降级 Markdown 和组件源码区间。`DIL.useState()` 被补充变量名 key；派生 const、动态属性或子节点通过 `__dilSafe` 局部恢复。坏语法片段被删除或替换，最终整体程序再用 `vm.Script` 检查；这里只有语法编译，不在服务端执行模型逻辑。依据：[compile](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/compiler/index.js)、[statements](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/compiler/statements.js)、[validate](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/compiler/validate.js)。

运行时是自写 React-like hooks，不是真正 React。支持 useState/useRef/useMemo/useCallback/useEffect 等；`useNow()` 固定为 0。流中替换 program 保留 stateSlots；state key 没有完整迁移、删除或命名空间管理。模型表达式是 JavaScript，用 `new Function('DIL','__dil',...)` 执行。依据：[Worker](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/sandbox/worker.js)。

组件分基础标签、`Chart` 编译 shim 和 PascalCase 宿主组件。基础渲染器是原生 DOM/CSS/SVG；Chart 会校验数据并转内建 chart/pie-chart。宿主组件必须同时有服务 resolution 结果及宿主注册，当前内建的宿主组件只有 MemoryCite；其余占位显示。它不是 ChatGPT 文档中提到的 30+283 个真实组件实现。依据：[组件分类与图表 shim](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/compiler/components.js)、[宿主组件注册](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/public/dil/renderer/components/host.js)。

## 工具调用：文档能力与现有代码有差距

当前模型请求没有 `tools`、`tool_choice` 或工具结果消息；SSE 解析只处理 content 与 reasoning_content。因此这是“生成文档”的单次模型调用，不是具有搜索、数据库、文件读写等工具的 agent 循环。系统提示公开 `GenUI.copy`、`GenUI.openUrl`、`GenUI.issueNewTurn`，但 Worker 没有定义 GenUI、host-call RPC 及动作实现：此类按钮渲染后点击可能出现未定义名称错误。不能把这个能力表直接复制进 WindGen prompt 而不给实现。依据：[LLM 请求和解析](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/agent/llm.js)、[提示中的 API](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/agent/system-prompt.js#L64)、[Worker 实际 API](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/sandbox/worker.js#L156)。

## 隔离设计与可验证的缺口

iframe 用 opaque origin；CSP 默认禁止资源及网络，唯一放行 blob/data Worker 和哈希固定 bootstrap，允许 eval。iframe 不显示生成页面，Worker 没有 DOM，元素由宿主画出。frame 对 Worker 启动有 1200ms blob→data fallback，对更新和 trigger 有 2500ms watchdog，最多重启一次并上报 quarantine。依据：[sandbox 属性](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/public/dil/sandbox.js#L44)、[CSP 与 watchdog](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/sandbox/frame.js)。

下面是静态源码指出的缺口；没有通过动态攻击复现，不应称为已验证漏洞：

- Worker 的 `new Function` 仍可访问 Worker 全局。代码没有实现分析文档描述的全局白名单、删除 ambient APIs 或冻结 primordials；“只传 DIL/__dil 就只剩这两个对象”这一注释不是成立的语言隔离机制。MVP 要依赖并验证浏览器边界，不能把两个函数参数当安全沙箱。依据：[求值点](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/sandbox/worker.js#L246)。
- `runtime.test.js` 中“no ambient authority”只在 Node harness 构造的有限 vm 全局里检查六项为 undefined；harness 本就没注入 fetch/importScripts，而浏览器 Worker 会自然提供这些全局。此测试不能证明真实浏览器删除了这些 API，也不能替代 CSP、断网与沙箱行为测试。依据：[该测试](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/test/runtime.test.js#L209)、[人为全局环境](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/tools/node-sandbox.js#L36)。
- 宿主 `image` 接收任意 HTTP(S) URL并在主文档加载。即使 Worker 断网，生成树仍能诱使宿主请求远端 URL；这证明“Worker 断网”与“整个生成界面不能外发数据”是两项不同约束。应在 MVP 暂不支持远程资源，或有明确宿主策略。依据：[image factory](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/public/dil/renderer/components/text.js#L91)。
- 初次 createRunner 路径没有像 setCompiledDil/trigger 一样显式启动 render watchdog；后续频繁更新会重新 arm 定时器，也需要测试忙循环期间预算是否被推迟。树限制深度 64，但没有节点数、字符串/属性总大小、计算和内存完整预算。依据：[frame createRunner 路径](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/sandbox/frame.js#L257)、[序列化限深](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/sandbox/worker.js#L187)。
- HTTP 没有会话身份校验，state store 以 messageId 为主键，更新不检查已有 conversationId 一致；不应直接部署成共享多用户产品。内存状态不会跨服务重启保留。依据：[路由](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/index.js)、[state store](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/view-state.js#L41)。
- 流错误后服务仍进入最终编译并发 finished_successfully；客户端 done 也写 success。连接关闭只跳出 chunk 循环，没有显式 AbortController 取消上游请求。GET query 包含用户 prompt；MVP 建议用 POST+fetch 流、不同的 success/error/cancelled 终态及取消传播。依据：[服务流终态](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/http/chat.js#L166)、[上游 fetch](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/agent/llm.js#L49)、[客户端 done](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/public/dil/message-view.js#L146)。
- 状态上报的 pending 先清空再请求；失败没有重试，也不检查 HTTP status。点击发送下一轮前没有强制 await 状态 flush，快速交互后马上提问可能读到旧快照。store 会保留所有消息状态，暂无 TTL/context budget。依据：[state reporter flush](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/public/dil/view-state.js#L29)、[快照上下文](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/view-state.js#L101)。

## 依赖、许可证、测试证据

参考实现要求 Node >=22，使用 node:http、vm、fs、crypto 等内建模块；运行时没有第三方 npm 依赖，开发依赖 linkedom `^0.18.13`。客户端原生 JS ES Modules，没有 TypeScript、React、Vite、shadcn/ui、Python、uv 或 dotenv。模型配置读取 process.env，没有 `.env` 自动加载。依据：[package.json](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/package.json)、[config](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/config.js)。

仓库 MIT，Copyright (c) 2026 DJJ；复用实质性代码须保留版权及许可文本。仓库自身声明是独立研究，与 OpenAI 无关；MIT 不等于授权使用 ChatGPT 商标或认证其架构结论。依据：[LICENSE](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/LICENSE)、[README](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/README.md)。

测试源码覆盖编译前缀、受控输入、状态跨重编译、图表、宿主 resolution 和状态回环，适合学习测试目标。但 README/博客的“98 个测试”“12 份模型输出”等历史统计未在本次执行验证；固定快照实际可见 4 个模型 fixture，加 captured source；robustness 语法检查每 5 字符取样，运行检查按 211 字符步进，并非字面上每个字符前缀都执行。Node VM harness 与真实 opaque-origin iframe+CSP+Worker 浏览器行为也应分别测试。依据：[robustness tests](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/test/robustness.test.js)、[runtime tests](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/test/runtime.test.js)、[frame harness 的边界说明](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/tools/frame-harness.js)。

## WindGen MVP 建议（设计建议，待用户范围决策）

保留四个体验不变量：自然语言生成实际可用界面；3–6 个控件的本地计算；流式生成时保留最后可用界面及语义状态；下一轮理解当前参数。先用计算器、比较器和筛选器三个场景验收，优先验证交互正确与状态回环，再扩展组件数量。

用户已指定 Python 3.12、uv、TypeScript、python-dotenv；第一轮访谈已确认“shroin ui”指 React + shadcn/ui，并选择本机单人使用、精简组件但完整核心闭环。建议 Python 承担 API、模型适配、上下文、会话与产物存储；TypeScript 承担语言解析/编译、沙箱运行时及 React+shadcn/ui 受控渲染器。编译器位置属于尚未固定的工程方案，应在实现前明确。不要假定 Python 的 JavaScript 解析和语法验证自然具备 Node vm.Script 的能力。

### 编译器迁移的三条路

参考编译器 parser/scanner/codegen/repair 大多是纯 JS，但入口使用 `Date`、components 使用 JS 数值行为、validate 使用 Node `vm.Script`；不能只改扩展名就假定整套代码可在浏览器编译。以下权衡是源码分析后的工程建议：

| 选择 | 优点 | 成本与边界 | MVP 适用情况 |
| --- | --- | --- | --- |
| 迁移为浏览器 TypeScript compiler，放独立编译 Worker | Python 服务保持单一后端；继承 DSL 恢复逻辑；源码流直传客户端；不新增 Node 部署进程 | 需替换 vm.Script 语法校验为纯 parser，不在主页面用 Function；服务的日志/持久化需显式回传编译 diagnostics；客户端增加 parser bundle，源码/协议版本要固定 | 若优先快速复用并接受“Python 编排、TS 编译执行”，这是建议默认 |
| Python 重写 DIL compiler | 服务端拥有确定编译产物；不要求 Node 运行时；容易结合后端持久化、策略与诊断 | 重做括号扫描、JS 字符串/模板、JS 表达式合法性、恢复逻辑和 Unicode 区间；不要用 Python eval 处理 JS；兼容性与回归样本成本最高 | 若“全部后端逻辑必须 Python”是硬约束，可先缩减 DSL 并明确不追求抓包逐字兼容 |
| Python API + Node/TS compiler sidecar | 原版 compile/validate 迁移最小，保留服务端全量前缀恢复语义；Python 对外 API和 dotenv 不变 | 两个进程/锁文件/依赖/发布面，sidecar 超时、并发、输入限制、断线取消需明确；这不是纯 Python 后端 | 若优先复刻服务端编译和产物，而部署 Node 被明确接受 |

浏览器方案应将“受信任的纯解析编译 Worker”与“执行不可信模型程序的 sandbox Worker”分开：前者不运行模型程序，只产出经过检查的 JS；后者由 opaque iframe+CSP 约束。Node sidecar 也只解析及编译模型代码，不应在 Node vm 中执行逻辑。参考依据：[compiler dependencies](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/compiler/index.js)、[vm syntax checker](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/compiler/validate.js)、[scanner](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/server/compiler/scanner.js)。

### 宿主 React + shadcn/ui 的渲染边界

不保留参考 demo 的直接 DOM factory/patcher：把 Worker 的树校验为自己的 TypeScript discriminated union 后递归映射到宿主 React 组件。受控 `Slider` 的值与 DIL number、shadcn Slider 的 number[] 之间由 adapter 转换；Select、Switch、Input 等同理。adapter 只发送 event handler token 和 JSON 值，绝不在 React 宿主求值表达式或把代码当事件 handler。shadcn 实现细节须按所选版本官方文档核实。

React reconciliation 应用稳定 artifactId + nodeId/key 管理节点身份；既要保护 focus/selection，也要防不同 revision 复用已经失效的 fnId。参考 Worker 每次 render 重建 fnTable，从 fn1 重新编号，而 DOM patch 按索引配对；当条件分支、排序或插入改变树形时，不能把索引自然稳定当保证。建议每个事件带 artifactId、revision、handlerId，拒绝陈旧 revision，模型 state key 与渲染 node key 分开设计。参考依据：[函数表重置](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/sandbox/worker.js#L246)、[索引 DOM patch](https://github.com/Disdjj/intelligent-ui-demo/blob/33297b8629c82fa5b7cc15dcd157ce90821463f3/replica/public/dil/renderer/patch.js#L103)。

先定义受控组件、表达式、状态键及事件协议；可选择有限 DIL 子集或自己的受限表示，但不能把改成完整 TSX/HTML 当作不影响理念的实现细节。为降低第一版复杂度，允许先流式展示文本并只执行完整合法 revision，明确记录与参考实现“任意不完整前缀也能逐步渲染”的差距。

可以借鉴编译器分工、keyed state、局部恢复、常量及渲染分离、函数引用跨边界、降级界面和测试样例；不宜照搬逆向路径命名、未实现的 GenUI 能力、整个组件清单、未经证实的全球白名单结论及默认多用户状态存储。Python env 应集中 load_dotenv 并校验，密钥留在服务端，真实模型之外提供 mock provider 便于无密钥验收。

建议第一版验收至少覆盖：有效生成和中途截断；非法组件/属性拒绝；公式运行错误局部降级；滑块/输入无需模型往返；重编译不重置状态；下一轮发送前 state flush；用户取消终止上游；恶意无限循环可终止；真实浏览器中网络/DOM/存储边界；模型错误不报告 success；服务重启的会话恢复范围有清晰定义。
