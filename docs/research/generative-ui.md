# WindGen：生成式交互界面调研

调研日期：2026-10-11（Asia/Shanghai）。状态：研究结论与方案建议，尚非最终实现规格。用户明确要求不用 wind_spec；本文采用普通项目文档。

## 目标与资料边界

用户希望在独立的 `/Users/alice/code/windgen` 实现 ChatGPT Intelligent UI 模式的 MVP。已确定 Python 3.12、uv、python-dotenv，前端 TypeScript；访谈确认 React + shadcn/ui、本机单人使用、精简组件但保留完整交互闭环。第二轮确定采用 DeepSeek 的 OpenAI 兼容接口、支持其他兼容模型，更新同一界面并保留旧版本；核心验收调整为机器学习/深度学习算法的生动教学演示。

主要参考是 [Disdjj/intelligent-ui-demo](https://github.com/Disdjj/intelligent-ui-demo) 及其 [中文文章](https://github.com/Disdjj/intelligent-ui-demo/blob/main/BLOG.zh-CN.md)。文章是一次抓包分析和作者复刻，不是 OpenAI 公开的 DIL 规范。模型提示词、编译器内部实现、后续对话状态的具体注入格式，文章都说明存在推断。WindGen 不以“与 ChatGPT 内部协议完全兼容”作为验收目标。

源码细节另见 [reference-source.md](reference-source.md)，该文固定研究提交并区分实测源码、作者观察和推断。

## 核心理念

生成结果是可以连续使用的交互工具。模型提供计算逻辑，用户操作在本地改变状态；宿主用已知组件展示结果，并把当前状态提供给下一轮模型。关键不是控件数量，而是这条闭环能否保持一致。

参考实现的链路是：模型输出 DIL 文档 → 编译为 JavaScript 和资源信息 → 流式传输 → iframe 内的 Worker 执行 → 输出元素树 → 宿主渲染。DIL 混合 Markdown、`{@body ...}` 计算声明和受控标签，不等于让模型输出任意网页。详见 [文章第 6、9—13 节](https://github.com/Disdjj/intelligent-ui-demo/blob/main/BLOG.zh-CN.md)。

可迁移的设计原则：

1. **协议分层。** 文档格式、流式事件、执行环境、组件渲染和会话存储各自承担明确职责。
2. **本地计算。** 滑块、筛选和排序不应每次触发模型请求。用户明确发起新一轮需求时才调用模型。
3. **组件由宿主拥有。** 模型选择允许的组件与属性，React + shadcn/ui 提供实际控件、样式与可访问性。
4. **状态需要稳定名字。** 更新代码时按名字恢复用户取值，而不是按调用顺序重新初始化。更名、类型变更、范围收窄需要明确规则。
5. **流式输入通常不完整。** 未闭合的标签、字符串或表达式不能导致整个会话白屏；保留上一份可运行界面，显示诊断与进度。
6. **运行结果也是不可信输入。** 元素树、属性、链接、状态和回调消息都需要校验与大小限制。
7. **行为可以验证。** 无密钥演示与真实模型接入分别记录，不能把演示成功当成真实模型可靠性证据。

## 相关方案与适用边界

| 方案 | 主要职责 | WindGen 的取舍建议 |
| --- | --- | --- |
| 参考仓库的 DIL 复刻 | 文档、编译、沙箱、组件与状态的完整演示 | 学习其链路，先支持一个明确的子集；已确认 MIT，复用代码需保留许可与版权 |
| A2UI | 声明式组件和数据协议，宿主使用原生控件渲染 | 借鉴组件目录、数据绑定和校验；基础协议本身不提供任意生成计算逻辑 |
| AG-UI | Agent 与前端之间的交互事件和状态传输 | 可作为后续互操作方案；首版可采用小型版本化 SSE 事件，避免引入不需要的 Agent 框架 |
| OpenAI 的公开 Apps / Plugins UI | 将工具和交互界面带入 ChatGPT 宿主 | 借鉴内联界面与持续对话体验；它与文章分析的内部 DIL 不是同一套公开契约 |

A2UI 官方介绍明确采用声明式数据、宿主组件和渐进渲染。检索时官网列出 v0.9.1 为当前版本、v1.0 为候选版本；若将来接入，应重新核实并固定版本。[A2UI 官方资料](https://a2ui.org/)

AG-UI 官方明确区分交互传输协议与生成式 UI 格式，可承载 A2UI 或自定义格式；因此选择 AG-UI 不等于已经解决编译与运行问题。[AG-UI 官方说明](https://docs.ag-ui.com/concepts/generative-ui-specs)

OpenAI 的公开设计指南描述内联、全屏和画中画等界面位置，以及对话与界面协作方式。它支持我们的交互设计参考，不能证明参考仓库对内部 DIL 的推断。[OpenAI UI guidelines](https://developers.openai.com/plugins/concepts/ui-guidelines)

## Python + TypeScript 的落地选择

Python 负责模型请求、会话、版本、状态快照和流式传输。TypeScript 负责受控文档编译、计算运行与 React 宿主渲染。计算发生在浏览器，Python 后端不执行模型生成的代码。这样可以保持 Python 服务，并避免为了 JavaScript 编译额外常驻一个 Node 服务。

编译位置仍是实现建议：浏览器侧 TypeScript 编译器能直接处理收到的文档增量，后端持久化原始文档和版本；它与参考仓库“服务器编译、发送程序补丁”的部署结构不同，但可保留用户要求的核心体验。需先用流式前缀与浏览器隔离验证这个方案，再固定最终接口。

| 模块 | 建议 |
| --- | --- |
| Python 服务 | FastAPI，异步模型适配器，小型 SSE 事件契约 |
| Python 版本与依赖 | `.python-version` 固定 3.12，`pyproject.toml` 明确版本范围，提交 `uv.lock` |
| 环境配置 | 项目根目录 `.env`，显式路径 `load_dotenv(..., override=False)`；提交 `.env.example`，密钥只保留在后端 |
| 前端 | React + TypeScript + Vite，shadcn/ui 组件源码纳入项目 |
| 数据 | 本机 SQLite 可保存会话、消息、生成文档版本和用户状态 |
| 文档格式 | 优先评估 DIL 风格的受控子集，不宣称兼容全部 DIL |
| 开发检查 | Python pytest；前端类型检查与针对编译、状态和隔离的测试；真实浏览器验收 |

这些是研究建议，框架和内部模块划分属于实现细节；模型服务、交互版本行为和产品范围继续通过访谈确定。

FastAPI 的 `StreamingResponse` 支持异步生成器。断开连接和取消必须真实终止上游请求，不能只停止前端显示。[FastAPI 官方文档](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse)

uv 支持 Python 版本固定和锁文件同步；python-dotenv 默认不覆盖已有环境变量。项目应显式定位自己的 `.env`，避免意外查找到其他仓库配置。[uv 项目同步](https://docs.astral.sh/uv/concepts/projects/sync/)、[python-dotenv 文档](https://github.com/theskumar/python-dotenv#readme)

shadcn/ui 提供可纳入项目的组件源码，并支持 Vite。生成程序不直接导入任意组件；通过宿主组件目录映射。[shadcn/ui 的 Vite 安装指南](https://ui.shadcn.com/docs/installation/vite)

## 隔离与稳定性必须做成实际行为

Worker 没有页面 DOM，但仍可使用网络 API 和 IndexedDB，因此“放进 Worker”不足以构成隔离。iframe 的 sandbox 控制额外权限；CSP 限制加载与连接。不要把主页面的登录、密钥或存储能力交给生成代码。[MDN Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)、[MDN iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox)

建议用专门的 iframe 启动运行 Worker，采用最小权限和严格 CSP；只输出受校验元素树。主线程持有可终止的计时器，限制文档长度、节点数量、树深度、状态体积和运行时长。`worker-src` 只控制 Worker 脚本来源，完整策略还需 `connect-src`、`script-src` 等，不能把它当作断网证明。[MDN worker-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/worker-src)

编译和执行也要隔离，避免模型输出让主线程陷入高开销解析。字符串删除、替换 `fetch` 等仅可作为附加限制，不能代替浏览器隔离。消息要验证来源、会话标识、请求标识、版本和结构。

SSE 是 UTF-8 文本事件流，以空行分隔消息，支持事件类型和事件 ID。WindGen 需要明确增量、最终状态、错误与取消语义，以及断线后是恢复还是重新生成；不能仅依赖连接自动重试。[MDN SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)

## MVP 的建议验收

- 用户自由输入需求，实际模型生成计算逻辑及受控组件，生成过程有进度和渐进展示。
- 操作滑块、筛选、排序时不调用模型，结果在本地更新。
- 生成中的新版本不会覆盖用户已经调整的同名状态，也不会丢失正在输入的焦点。
- 后续提问携带当前状态；例如用户已改动参数后说“按现在的参数换一种计算方式”，模型使用新值。
- 取消、模型错误、未完成文档和运行错误能恢复，保留已有可运行界面。
- 会话刷新可恢复；样例模式标识清楚，真实模型测试单独记录。
- 生成代码尝试联网、访问宿主或死循环时，浏览器隔离和超时实际有效。

已确定：算法教学作为核心场景，后续修改更新同一界面并保留旧版本，模型采用 DeepSeek 及其他 OpenAI 兼容接口。自由输入算法名，以梯度下降/线性回归、K-means、小型网络前向与反向传播验收；面向已有基础、侧重公式与实现细节的学习者。Q13选择卷积张量块、注意力空间节点/动态连线、优化粒子/移动物体作为三维场景例子。MVP 不要求账号系统、插件市场、MCP 工具循环、多租户或对全部 ChatGPT 内部卡片兼容。

## 算法教学对原方案的影响

用户要求是“教程场景，给出一个机器学习或深度学习的算法，用生动的形式做演示”，并进一步明确已有基础、侧重公式和实现细节、需要更自由的三维场景。因此不能只把普通控件画出来：模型生成的程序应表达算法状态转移，把输入、参数、中间量和输出串成可观察的学习过程。计算限定浏览器内的小规模教学计算。

建议让宿主提供通用绘图和控制原语，例如二维坐标图、折线/散点、节点与边、表格、公式、滑块、按钮；三维还需要可组合的组、物体、变换、几何数据与交互。用户未接受只用散点、连线和曲面限定三维范围，Q13进一步选择卷积张量块、注意力空间节点和优化运动例子。算法本身的更新方程由生成程序表达，不把“一个算法一个写死组件”作为主要实现方式。将教程描述与数值核验分别处理：动画好看不能证明梯度、损失和更新正确。

动画需要受控时钟、单步/播放/暂停语义、运行预算和重置规则；不能把无限动画循环直接交给无约束生成代码。状态回灌需包含当前步骤、参数、选择的数据集以及必要的算法状态，并限制序列历史大小。下一轮模型既能继续讲解当前步骤，也能按请求修改演示。Q12 已确认：普通修改保留当前参数；明确指定的新参数优先；参数变化后重置进度，旧版本仍保留原状态。

具体算法数学与视觉核验记录在算法教学研究文档，全部用户答案和实现范围见 [MVP 文档](../mvp.md)。产品范围已确认，MVP 已实现；实际验证与限制见 [实测记录](../verification.md)。

## DeepSeek 接入核实

DeepSeek 官方说明支持 OpenAI 兼容 API，可使用 OpenAI SDK，设置 `stream: true` 得到流式响应；OpenAI 风格的基础地址为 `https://api.deepseek.com`，接口为 `/chat/completions`。[DeepSeek 官方 API 文档](https://api-docs.deepseek.com/)

截至调研，官方示例的模型名为 `deepseek-flash`；实际项目应通过 `LLM_BASE_URL`、`LLM_MODEL`、`LLM_API_KEY` 等后端配置指定，不能把模型名写死。DeepSeek 特有的思考参数应与公共兼容接口分开处理，避免切换服务后携带不支持的字段。未发起收费模型请求，也未读取用户密钥。

## 本地事实

- `/Users/alice/code/windgen` 初始为空目录，无 Git、源码或 AGENTS.md。
- `/Users/alice/code/windplay` 是另一个独立仓库；此次不修改它。
- 本机有 uv 0.12.19、uv 管理的 Python 3.12.13 与 Node 26.10.0。
- 未找到 x-cmd；此次未为调研安装额外系统工具。
- 尚未运行参考仓库程序、真实模型或 WindGen 应用。文档调研不能代替运行验收。
