# 交互教学组件与 Transformer 样例

本文记录当前实现，补充 [DIL 与场景协议](protocol.md)。WindGen 在现有对话里组合公式、矩阵、二维注意力图与有状态控件；这些组件由宿主渲染，计算在隔离 Worker 中完成。它不声明兼容 ChatGPT 的内部协议。

## 使用固定 Transformer 样例

按 README 启动服务后，在首页点击「Transformer」。固定样例不需要 API 密钥，源码位于 [examples/transformer.dil](../examples/transformer.dil)，界面标记为「固定演示样例」。输入新需求、继续追问或点击「修复演示」会调用真实模型，需要先保存模型配置。

样例使用「我、喜欢、学习、自然、语言、处理」六个 token，表示维度为 4，注意力头数为 2，每头维度为 2。阶段编号为 0–6；「单步」、进度滑块、播放/暂停、重置与 0.5×/1×/2×/4×速度控制推进过程。重置只将阶段归零，不将头、token、温度与掩码恢复默认值。

| 阶段 | 当前可见内容 | 主要形状 |
| --- | --- | --- |
| 0 词向量与位置编码 | E、P、X=E+P | 6×4 |
| 1 Q/K/V 投影 | 当前头的 Q、K、V | 每个 6×2 |
| 2 缩放点积与掩码 | S=QKᵀ/√2、掩码后的分数 | 6×6 |
| 3 softmax 与信息汇聚 | A、选中权重、行和、token 连接图、当前头输出 | A 为 6×6，头输出为 6×2 |
| 4 多头拼接与输出投影 | C=Concat(H₀,H₁)、O=CWₒ | 6×4 |
| 5 残差与 LayerNorm | R=X+O、按 token 的特征维归一化 Z | 6×4 |
| 6 前馈网络与输出 | H=ReLU(ZW₁)、Y=Z+HW₂ | H 为 6×8，Y 为 6×4 |

阶段切换使用 DIL 条件分支替换内容。参数在切换阶段后仍保留，计算保留完整浮点精度，显示时才四舍五入。选择注意力头改变当前头的矩阵与连接；选择 Query 改变高亮行和连接起点；温度（0.2–3）与双向/因果掩码改变注意力及其下游输出。因果掩码令 j>i 的权重严格为零。

阶段 3 点击热力图单元格会同时选择其 Query 行并更新「选中单元格权重」。点击图上方 token 按钮或 Query 下拉框会切换 Query，并保留已选列。热力图深浅对应当前数值；连接粗细与透明度对应所选 Query 的实际权重。零权重画成淡虚线，并明确显示 0.0000。连接图是二维 SVG，无需 WebGL；矩阵在自己的区域横向滚动，手机无需横向拖动整个会话。

这是确定性合成教学数据：手工词向量、固定权重、单个微型计算块，没有训练、分词器、词表预测、dropout 或完整语言模型推理。LayerNorm 不含可学习的 γ/β，前馈层无偏置，最终前馈残差后没有第二次 LayerNorm。它用于核对公式、维度与数值流，没有语言理解能力。真实模型生成的教程仍需检查数学和实现；宿主组件及有界运算不能保证任意生成程序正确。

## 受控组件协议

每条 JavaScript 声明写在一行 `{@body ...}`，状态使用 `DIL.useState`，事件处理函数在沙箱中调用。以下组件补充原有布局、公式、表格与场景原语。

| 组件 | 主要属性 | 交互与限制 |
| --- | --- | --- |
| `matrix` | `data`（也接受 `values`）、`label`、`rowLabels`、`columnLabels`、`precision`、`selectedRow`、`selected` | `onSelect(row,column)` 使用零基索引；最多 32×32，行宽必须一致 |
| `heatmap` | 同 `matrix`，另有 `min`、`max` | 数值映射为背景深浅；建议注意力使用 `min={0} max={1}`；选中须绑定状态和回调 |
| `token-graph` | `tokens`、`weights`、`selected`、`label` | `onSelect(index)`；最多 16 个 token；二维权重取 `weights[selected][j]`，也接受当前行一维权重；可视权重限制在 0–1 |
| `select` | `label`、`value`、`options={[{label,value}]}` | `onChange(value)` 回传原选项值类型，保留 number、boolean，不仅是 DOM 字符串 |
| `segmented-control` | `label`、`value`、`options` | 分组按钮，`onChange(value)`；选中态使用严格值相等 |
| `list`、`list-item` | 子节点；`list marker="number"` | 有序/无序列表，也用于 Markdown 列表降级输出 |
| `disclosure` | `label`、`open`、子节点 | 原生折叠详情；样例用于查看计算实现 |
| `progress` | `label`、`value`、`max` | 原生进度展示 |

矩阵可以显示有限数值、字符串或空单元格；非有限数值及其他值显示为「—」，字符串最多 80 字符。数值显示精度默认 4，限制为 0–8。矩阵组件的点击只触发回调，不会自行修改数据。矩阵显示限制（32×32）小于数值运算限制（64×64），生成文档须同时遵守两者。

```text
{@body const [head,setHead] = DIL.useState(0)}
{@body const [causal,setCausal] = DIL.useState(false)}
<select label="注意力头" value={head} options={[{label:'头 0',value:0},{label:'头 1',value:1}]} onChange={setHead}/>
<select label="掩码" value={causal} options={[{label:'双向',value:false},{label:'因果',value:true}]} onChange={setCausal}/>
```

阶段条件使用 `{#if step===0}...{:else if step===1}...{:else}...{/if}`；不要只改变标题而持续展示全部阶段。注意力热力图使用 `heatmap`，普通折线 `chart` 不代表二维权重矩阵。

## DIL.math 数值协议

`DIL.math` 仅暴露在计算 Worker 内，为冻结的纯数值帮助函数集合。一般输入须为非空矩阵，行、列各为 1–64，行宽一致且元素为有限 JavaScript number；不存在自动广播、GPU 计算或包导入。

| 函数 | 输入和输出 | 错误条件 |
| --- | --- | --- |
| `matmul(A,B)` | m×k 乘 k×n，得到 m×n | 内维不匹配；消息包含两个矩阵形状 |
| `transpose(A)` | m×n → n×m | 非法矩阵 |
| `add(A,B)` | 同形逐元素相加 | 形状不同，不做广播 |
| `softmax(row,T=1,mask=[])` | 长度 1–64，返回等长概率向量 | T 非有限或 ≤0；非空 mask 长度不一致；全部位置被屏蔽或全为 −Infinity |
| `layerNorm(A,epsilon=1e-5)` | 每行沿特征维归一化，形状不变 | epsilon 非有限或 ≤0；非法矩阵 |
| `splitHeads(A,count)` | n×d → count 个 n×(d/count) | count 非整数、不在 1–16 或不能整除 d |
| `concatHeads(heads)` | 按特征维拼接，token 行数不变 | 头数不在 1–16、各头行数不同、输出宽度超过 64 或非法矩阵 |

softmax 允许输入 −Infinity；`mask` 中 truthy 的位置被屏蔽，生成协议使用 boolean 数组。函数先减去未屏蔽最大值再指数化，屏蔽处输出精确零。其行和在浮点精度内为 1；不要在计算链中提前 `toFixed`，否则会改变归一化与后续结果。LayerNorm 按总体方差除以特征数，常量行得到零向量。

帮助函数检查输入形状和边界；极端有限输入的乘加仍可能溢出，不能把它理解成任意数值范围都可安全计算。错误应通过教程诊断呈现并修复，不能用空表伪装成已成功计算。

## 流式生成、状态与修复

模型提示词要求先输出简短 Markdown 标题和解释，再逐步添加计算与控件。前端合并待编译前缀，以约 70ms 节流调度（较大增量可提前编译），复用编译与计算 Worker；未完成前缀暂时为空时保留最后一个有用画面。完整的首行 `windgen-state` 元数据到齐后才提交初始化。流式解析容错不等于完成后忽略错误。

生成结束后，运行时 warnings 与 invalid_statement / invalid_expression / invalid_program 诊断进入「部分计算未能运行，当前演示不完整」区域，最多列出 12 条去重问题，可展开「查看问题」。点击「修复演示」提交诊断、当前版本 ID、源码和最新客户端状态，要求模型保留用户参数、检查矩阵维度、多头计算与阶段分支，返回完整新版本。它需要真实模型；回归测试中的模拟响应不是线上自动修复保证。

执行/解析错误另有错误栏与「重新加载」；重新加载在本地重新编译当前版本，不调用模型。源码标签保留原文与解析诊断；状态标签展示下一轮携带的快照。发送追问时直接取最新客户端快照，不等待延迟保存。普通表现形式修改保留同名状态；显式参数修改可通过首行元数据 `set` 与 `reset` 更新参数及重新初始化指定状态。版本栏可查看旧版本，不会改写历史源码。

SSE 保留 start、source 增量、可选 thinking、done/error 事件和取消终态；停止生成保留已收到内容，不标记为完整成功。沙箱、源码长度、状态与树大小、执行超时沿用 [协议限制](protocol.md)，不提供无限矩阵或进程级资源隔离。

## 验证证据

本次交付记录：25 个前端单元测试、23 个后端测试、12 个浏览器测试通过；最终手机图中文字调整后，另跑 2 个 focused 浏览器测试及生产构建通过。数字代表本次验收，不是未来版本的固定测试数量。

- `frontend/src/runtime/math.test.ts` 核对独立矩阵结果、维度错误、拆头/拼头、稳定 softmax、精确零掩码、行和与逐行 LayerNorm，并检查矩阵显示边界。
- `frontend/src/compiler/compatibility.test.ts` 覆盖 Markdown 列表、行内 LaTeX 花括号和多余闭合标签恢复。
- `frontend/e2e/intelligent-ui.spec.ts` 覆盖实际阶段替换、36 个注意力单元格、token 选择、number/boolean 下拉状态、因果零权重、最终输出和移动端外层无横向溢出。
- 同一浏览器测试回放 `frontend/test-fixtures/transformer-broken.dil` 的真实失败文档：其多头拼接按 token 数构建特征维造成后续计算失败。测试确认显示不完整诊断、列表正常、`</box>` 不泄漏，并验证修复请求引用原版本且携带运行诊断；模拟返回正确样例后不完整提示消失。它验证恢复路径，不声称原失败程序的数学已被宿主自动纠正。

视觉证据位于 `.impeccable/review/intelligent-ui/`：`desktop.png`（1280×720）、`mobile.png`（390×844）、`user-567.png`（567×987）、`desktop-graph.png` 和 `mobile-graph.png`。后两张滚动至连接图所在会话区域。手机 SVG 文字采用 24px 源字号，并已重拍验证；该数值服务本组件缩放后的可读性，不是新增通用字号规则。最终独立复核 disposition 为 ship。

本次属于既有课堂表面的扩展，保留 `DESIGN.md` 与 `.impeccable/design.json`。既有 CSS 的可选深色/主题色及系统显示字体与旧记录存在偏差，本次未将它们或已有紧凑辅助字号重新确立为视觉规范。

## 生成张量场景的可用性修复

解析器现在跳过完整与流式未闭合的 HTML 注释，`windgen-state` 不进入教程正文。状态元数据在计算初始化时应用一次，后续源码增量不会反复覆盖用户步骤。

三维宿主按当前几何体包围盒自动取景，忽略孤立文字标签；阶段几何布局改变、窗口大小改变或「复位视角」时重新取景，普通数值变化保留用户旋转。嵌套组的位移、旋转与缩放进入取景计算。密集场景隐藏批量单元标签，只显示选中对象标签和检查数值，稀疏场景的标签总数限制为 12。

生成协议要求 Q/K/V 使用分离的几何层、数值对象附带 `value`，非空间阶段使用二维计算视图。真实生成文档回归包括七个阶段、掩码精确零、行和、实际 4→8→4 前馈层、Q/K/V 间距及有限单元值；流式测试覆盖拆分状态标记不泄漏、元数据初始化后单步仍然有效。

## Intent routing and continuous animation

Live requests first pass through a bounded JSON intent classifier. Ordinary conversation streams as text and is persisted with `kind=chat`; it does not start the document compiler. Requests to create or change an artifact use `kind=lesson`. Existing databases migrate additively, and a lesson modification after chat reuses the last lesson and its saved parameter state.

Animation requests add a contract for the host-rendered `flow-diagram`: computed nodes/weighted edges, continuous SVG particles, pause/resume, speed, and node selection. The host owns animation timing; the generated worker only calculates values on parameter changes. Reduced-motion users start paused. Missing animation triggers one bounded regeneration (`source_reset`), then a visible error if still absent. This is a continuous diagram, not GIF export or arbitrary animation-code execution.

Regression coverage: `tests/test_intent.py`, `frontend/e2e/intent-animation.spec.ts`, including replay of a real model-generated attention calculation in `frontend/test-fixtures/attention-flow.dil`. The browser checks particle movement and pause, recalculated normalized weights, playback speed, and narrow-screen overflow.

### Silent correction and early text

Completed live lessons with compiler/runtime diagnostics request an internal correction, at most twice per mounted conversation revision. The request carries diagnostics separately from the user's prompt, bypasses intent classification, reuses the same revision and preserves current parameters. Intermediate code errors are not shown in the tutorial; exhausted retries show a concise failure message. Compiler asset failures retain the refresh action. Model instructions prohibit repair narration; legacy introductory “修复说明” paragraphs are removed from the rendered projection without editing computation or saved source.

While streamed computation is incomplete and no working snapshot exists, the already-received Markdown introduction renders directly as escaped text. This does not wait for sandbox evaluation and does not expose incomplete program statements. Working snapshots remain visible during later failures. Regression tests cover automatic repair, bounded failures, and first visible text within 1.5 seconds of receiving it while the response is still streaming.

### Rebuild-safe compiler loading

Production uses `/compiler-worker.js` with `no-store`. Requests from already-open pages to a removed `/assets/worker-<hash>.js` resolve to the current protocol-v1 compiler, so rebuilding no longer strands an open lesson on a 404. This compatibility mapping must be revisited if the compiler protocol changes. Tests cover the retired URL executing in a real browser, current production startup, and slow/failed startup.

Submitted prompts are acknowledged before intent classification completes. Static introductory text is also available after completion or compiler failure, instead of being restricted to the streaming status. This reduces blank waiting states; upstream model time-to-first-token is still a separate network/model latency.
