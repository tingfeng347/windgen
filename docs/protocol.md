# WindGen 交互文档与场景协议

本项目使用 DIL 风格文档：Markdown + 每行 `{@body JavaScript}` + 受控标签。系统提示词 `src/windgen/prompt.py` 是模型实际收到的完整协议，本文说明部署和限制。

## 编译和运行

`frontend/src/compiler/vendor` 为保留许可证的 MIT 编译器迁移，仍为 JavaScript 第三方模块；其调用者、编译 Worker、沙箱客户端和宿主界面使用 TypeScript。Acorn 只检查语法，不执行表达式。编译结果含 `code/constants/appData/stateKeys/diagnostics`；流式前缀容错，并用变量名重写 keyed `useState`。

模型程序仅在专用 iframe 内 blob Worker 执行。iframe 使用 `sandbox="allow-scripts"`，不授予同源权限；bootstrap 哈希固定，CSP 禁止连接与外部资源。父页面与 iframe 消息验证 source 和随机 token；事件带 runtime version，过期 handler 不执行。

运行时支持 `DIL.useState/useRef/useMemo/useCallback/useConstants/useAppData`。不支持自由 effect/timer；`useNow` 为固定值。单步和播放由宿主 `stepper` 驱动有界状态更新。

## 普通组件

支持 box/row/column/grid/card/text/title/caption/bold/label/code/badge/button/input/textarea/checkbox/select/slider/table/metric/formula/chart/scene/stepper。未知组件显示诊断占位；不放行模型指定的任意 HTML、图片 URL、CSS 或包导入。

Slider/Select/Input 的 `onChange` 收到控件值；Button 的 `onClick` 无参数。Formula 使用 KaTeX，`trust:false`。图表接受记录数组与 `xKey/yKey`。表格接受列名与二维 rows 数组。

```text
{@body const [step,setStep] = DIL.useState(0)}
<stepper value={step} onChange={setStep} max={30}/>
```

## 三维场景

`scene` 是可选组件。默认选择公式、表格与二维图表，仅在空间结构、第三维有教学价值或用户明确要求时使用三维；单变量曲线、普通注意力图和网络关系图不因装饰需要而升为三维。模型提示词的完整默认示例采用二维图表。

`scene` 接受对象数组、可选 camera/selected/caption 和 onSelect(id)。支持可组合 group、box、sphere、point、cylinder、cone、plane、line、mesh、label；位置、旋转（弧度）、缩放、尺寸均为三个有限数值。

```json
{"id":"tensor-0","type":"box","position":[0,0,0],"size":[0.8,0.3,0.8],"color":"#607c9e","label":"x=3"}
```

Line 使用 points 三维坐标数组。Mesh 使用 vertices 与三角形 indices。Group 使用 children。几何不含 shader、纹理 URL 或可执行属性。对象可以通过模型生成数据/公式随算法步骤变化；布局坐标、特征坐标和参数坐标需在教程中说明含义。

场景最多 600 个对象、嵌套 12 层；单 mesh 最多 10000 个顶点/30000 个索引，line 最多 2000 点；坐标绝对值不超过 10000。相机轨道旋转与复位由宿主完成，点击对象按 id 回传给沙箱。

## 状态与版本

新生成保存独立 revision，旧 revision 的源码和当前快照保留。发送新一轮时直接把客户端最新快照写入请求，不等待合并上报定时器。普通更新保留同名状态；明确参数修改可用文档首行：

```text
<!-- windgen-state: {"set":{"learningRate":0.1},"reset":["step","history","playing"]} -->
```

首行必须完整后才提交初始化。reset 删除种子中指定键，让新程序使用默认初始值；set 指定新参数。派生值由新程序重新计算，不持久化旧梯度作为新参数的结果。任意模型的数学正确性需另行核验。

## API 和终态

- `POST /api/conversations`：新会话。
- `GET /api/conversations` 与 `GET /api/conversations/{id}`：会话/历史版本。
- `DELETE /api/conversations/{id}`：原子删除单条会话及其版本；返回 deleted 数量。不存在时返回 0；正在生成的会话返回 409。
- `DELETE /api/conversations`：原子删除全部会话及版本；有生成任务时返回 409。删除接口检查浏览器请求来源；已删除版本的延迟状态上传不能重新创建会话。
- `POST /api/conversations/{id}/generate`：prompt、mode、example、revision_id、state；返回 SSE。
- `PUT /api/conversations/{id}/revisions/{rid}/state`：合并上报的完整快照。
- `GET /api/config`：模型名称、基础地址、是否配置和样例名，不返回密钥。
- `PUT /api/config`：base_url、model、可选 api_key；原子写入私有 `.env` 后立即应用。相同基础地址留空保留密钥，切换地址需要新密钥；生成期间拒绝保存。
- `POST /api/config/test`：测试未保存的配置，查询 `/models`；只验证连接与模型列表，不验证生成能力或配额。错误不返回上游响应正文，不修改已保存配置。

SSE 事件依次含 start、source 增量、可选 thinking 进度、done 或 error。用户断开连接触发取消，上游 HTTP stream 被关闭；complete/error/cancelled 独立存储。无完整结束的模型流不报成功。

文档长度上限 150000 字符，状态不超过 100000 UTF-8 字节，序列化树上限 600000 字符/10000 节点/48 层；编译 watchdog 为 3 秒，计算 watchdog 为 1.8 秒。浏览器内存与 GPU 资源仍受浏览器实现约束，不提供进程级硬内存上限。
