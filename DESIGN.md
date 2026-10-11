---
name: "WindGen"
description: "暖纸面上的算法交互课堂：对话、公式、数值与三维观察。"
colors:
  primary: "#292724"
  background: "#fdfcf9"
  foreground: "#2c2924"
  secondary: "#eeeae3"
  border: "#e2e0dc"
  sidebar: "#f3f0e9"
  sidebar-active: "#e6e1d8"
  scene: "#f4f1ec"
  mist-blue: "#607c9e"
  lavender: "#8f83b0"
  amber: "#cc9553"
  text-muted: "#706b63"
  text-support: "#6f6961"
  formula-surface: "#f5f2ed"
  composer-surface: "#f1eee8"
  caption-surface: "#eeebe5"
  revision-selected: "#e7edf4"
  revision-ink: "#384f6b"
  revision-border: "#ccd6e2"
  user-surface: "#f2f1f0"
  error: "#9d4436"
  error-surface: "#fff0e8"
  destructive: "#b54132"
  grid-major: "#cfc8bc"
  grid-minor: "#e5dfd5"
  label-ink: "#38342e"
  label-selected: "#fff0db"
  label-selected-ink: "#714827"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", sans-serif"
    fontSize: "42px"
    fontWeight: 550
    lineHeight: 1.32
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", sans-serif"
    fontSize: "23px"
    fontWeight: 550
    lineHeight: 1.5
    letterSpacing: "-0.025em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", sans-serif"
    fontSize: "18px"
    fontWeight: 550
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", sans-serif"
    fontSize: "14px"
    lineHeight: 1.65
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", sans-serif"
    fontSize: "12px"
    lineHeight: 1.65
  metric:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", sans-serif"
    fontSize: "21px"
    fontWeight: 550
  code:
    fontFamily: "\"SFMono-Regular\", Consolas, monospace"
    fontSize: "12px"
    lineHeight: 1.8
  scene-label:
    fontFamily: "system-ui"
    fontSize: "14px"
rounded:
  control: "6px"
  medium: "8px"
  large: "12px"
  message: "16px"
  compact: "5px"
  revision: "7px"
  pill: "9999px"
spacing:
  micro: "3px"
  xs: "7px"
  sm: "8px"
  control: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    rounded: "{rounded.medium}"
    height: "36px"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.medium}"
    height: "36px"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.medium}"
    height: "36px"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.medium}"
    height: "32px"
    padding: "0 12px"
  parameter-input:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
    typography: "{typography.label}"
  history-nav:
    backgroundColor: "{colors.sidebar}"
    padding: "10px 12px"
    rounded: "{rounded.medium}"
    width: "248px"
  revision-chip:
    backgroundColor: "{colors.composer-surface}"
    textColor: "#716c64"
    rounded: "{rounded.revision}"
    padding: "5px 13px"
    typography: "{typography.label}"
  revision-chip-selected:
    backgroundColor: "{colors.revision-selected}"
    textColor: "{colors.revision-ink}"
    rounded: "{rounded.revision}"
    padding: "5px 13px"
  composer:
    backgroundColor: "{colors.composer-surface}"
    rounded: "{rounded.message}"
    padding: "15px 17px 12px"
    width: "860px"
  scene:
    backgroundColor: "{colors.scene}"
    rounded: "{rounded.large}"
    height: "400px"
  formula:
    backgroundColor: "{colors.formula-surface}"
    rounded: "{rounded.medium}"
    padding: "15px 20px"
  lesson-tabs:
    backgroundColor: "{colors.secondary}"
    rounded: "{rounded.large}"
    height: "36px"
    padding: "3px"
  lesson-tab-active:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.medium}"
    padding: "4px 8px"
---

# Design System: WindGen

## Overview

**Creative North Star: "暖纸算法课堂"**

WindGen 用暖纸面、炭黑动作和低饱和数据色承载可持续修改的算法教程。熟悉的会话导航、右侧用户消息和底部输入建立连续对话；公式、数值与真实三维几何在同一条助手回复中展开。

浅色表面、细边界和留白参考 OpenDesign；雾蓝、灰紫和琥珀属于本项目的教学表达。用户明确排除绿色，并要求保留 ChatGPT 式对话交互；WindGen 不冒称 OpenAI 产品。本文记录 frontend/src 已实现的系统，生产构建的样式确认了组件圆角与动画时长；它不是待实现的视觉提案。

**Key Characteristics:**
- 暖纸底面与暖灰侧栏，炭黑承载主要动作。
- 低饱和色区分算法对象和选中状态。
- 宽幅内联课堂，公式和数值保持可核对。
- 中文系统字体、KaTeX 数学字体、等宽代码各司其职。

## Colors

上方 frontmatter 是颜色的规范层；以下按用途说明，不另建色板。

### Primary

- **炭黑（primary）**：发送、播放和新操作的主要动作；品牌图标沿用同一颜色。

### Secondary

- **雾蓝（mist-blue）**：参数值、曲线、默认三维对象与键盘焦点。
- **灰紫（lavender）**：区分另一组教学对象，避免仅靠形状解释分组。

### Tertiary

- **琥珀（amber）**：当前选中的三维几何；选中标签另用浅琥珀底和深棕文字。

### Neutral

- **暖纸（background）**：主工作区与主要按钮的反白字。
- **墨色（foreground）**：正文和控件默认文字，独立于炭黑动作色。
- **暖灰（sidebar / secondary / scene）**：分别承载会话导航、辅助控件和三维背景；不合并为一个近似色。
- **细边界（border）**：表面和输入的低对比结构线。场景主次网格使用独立几何颜色。
- **灰字（text-muted / text-support）**：说明与状态；辅助字不能通过降低透明度进一步变淡。
- **冷灰蓝选择（revision-selected / revision-ink / revision-border）**：版本切换反馈。
- **砖红（error / destructive）与浅暖错误底（error-surface）**：错误提示和破坏性按钮。

**The Data Color Rule.** 雾蓝、灰紫和琥珀服务于算法角色与选择反馈；不要把数据颜色扩散成整页装饰。

## Typography

**Display / Body Font:** 中文与界面使用系统字体栈，准确值见 frontmatter；不依赖远程字体加载。
**Math Font:** KaTeX 自带数学字体和 displayMode 排版。
**Code Font:** SFMono-Regular、Consolas、monospace。数值表、指标和参数使用 tabular-nums；不是所有指标都采用等宽字体。

### Hierarchy

- **Display**：欢迎页标题（42px、550、行高 1.32、字距 -0.03em）；1000px 以下变为 36px，720px 以下为 33px。
- **Headline**：教程标题（23px、550、行高 1.5、字距 -0.025em）；手机为 20px。
- **Title**：应用头部（18px、550）。品牌为 21px。
- **Body**：教程与输入（14px、行高继承 1.65）；教程段落上限 76ch。欢迎说明为 15px、行高 1.9。
- **Label**：参数和步骤为 12px；会话历史为 13px；辅助状态通常为 11px。
- **Metric**：数值（21px、550），手机为 18px。
- **Code**：源码与状态（12px、行高 1.8），在自身区域滚动。
- **Scene label**：Three.js sprite 的纹理使用 32px system-ui 字体、64px 纹理高度，屏幕高度维持 28px，产生约 14px 可读文字。它不是 CSS 的旧 10px 标签样式。

**The Numerical Clarity Rule.** 保留 KaTeX 的数学排版和数值的 tabular-nums；三维对象标签保持屏幕空间可读，不随相机距离缩成几何细节。

## Layout

应用采用 100dvh 高度的左右分栏。桌面侧栏宽 248px，内边距 25px 18px；1000px 以下缩至 210px。头部最小高度 66px，内边距 15px 28px。会话区独立滚动，内边距 24px 32px 40px，内联教程上限 920px；欢迎内容上限 650px。用户消息右对齐，上限 75% 宽。

输入区位于主列底部，不参与会话滚动，通过 flex 布局保持可见，不使用覆盖正文的 position:fixed。输入框上限 860px，内边距 15px 17px 12px。内容组织以 7–8px 控件间隔、16–20px 内部间隔和 24–32px 区段留白形成节奏。

720px 以下侧栏变为 250px 宽的左侧抽屉，配遮罩和顶部切换按钮；会话区内边距改为 18px 16px，输入区为 8px 12px。用户消息上限 90%，多列教学网格堆为一列。三维画布在桌面、1000px 以下、720px 以下分别高 400px、340px、320px。公式、表格与源码在各自容器内处理溢出。

历史导航按钮禁止 flex 收缩，长标题省略；导航本身滚动。这是行高度稳定性的约束，不是固定历史条目数量。

## Elevation & Depth

表面色差是主要层级，细边界补充结构。输入框有轻微环境阴影（0 5px 18px -12px #25352d26）；轮廓按钮使用构建中的 shadow-xs，活动标签和滑块拇指使用 shadow-sm。三维深度由真实几何、灯光和相机提供：ambientLight 强度 1.5，directionalLight 强度 2；几何材质 roughness 0.5、metalness 0.08。

**The Quiet Surface Rule.** 以表面色差和细边界组织深度；阴影仅辅助输入框和控件，不成为内容分隔的主体。

## Shapes

普通按钮与活动标签为中等圆角（8px），轮廓输入为较小圆角（6px）。三维容器和标签组为较大圆角（12px），用户消息与输入框为 16px。版本按钮和检查器为 7px；小标签为 5px。滑块使用圆形拇指与胶囊轨道。结构线通常为 1px，不使用硬偏移阴影或复杂装饰边框。

## Components

### Buttons

炭黑主按钮、暖灰辅助按钮、纸面轮廓按钮与透明 ghost 按钮共同构成操作层级。默认高度 36px，sm 为 32px，icon 为 36px 方形；主按钮常规内边距为 8px 16px，含图标时水平内边距缩为 12px。禁用态 opacity 0.5，阻止指针操作。hover 通过背景变化反馈；可见焦点既有雾蓝全局轮廓（2px、偏移 3px），也有组件的炭黑半透明 3px ring。组件状态默认过渡 150ms。

### Chips

版本按钮采用暖灰底、7px 圆角与 5px 13px 内边距；当前版本切换为冷灰蓝底、深蓝灰字和边框。版本行在自身区域横向滚动。教学 badge 更紧凑，采用 5px 圆角、3px 7px 内边距与 11px 字号。

### Cards / Containers

教程正文直接展开，不强制包进卡片。公式使用暖灰纸面、8px 圆角和 15px 20px 内边距；源码块采用浅灰面、8px 圆角、16px 20px 内边距。三维演示是 12px 圆角的宽幅内联容器，带顶部操作栏和底部说明。用户消息为右对齐的灰色圆角气泡。

### Inputs / Fields

底部输入采用暖灰面、1px 细边界和 16px 圆角，textarea 透明、无独立边框，可继续当前演示。参数字段宽度上限 400px，以 12px 标签和蓝灰数值配对；输入使用纸面、1px 边框、6px 圆角、8px 10px 内边距。滑块轨道高 6px、拇指直径 16px，炭黑范围与白色拇指形成读数层级。

### Navigation

侧栏为暖灰色的会话列表；行采用 13px 文字、10px 12px 内边距、8px 圆角。hover 与当前会话共用更深的暖灰面，长标题省略。教程标签在暖灰组内切换为纸面活动项，并用轻微阴影强调层级；源码和状态仍属于同一个内联教程。移动端抽屉以 200ms transform 过渡，遮罩独立承载关闭操作。

### Three-dimensional lesson

Three.js 提供几何网格、OrbitControls、真实几何和屏幕空间标签。拖动旋转、滚轮缩放、点选对象；选中网格为琥珀，标签改为浅琥珀，底部检查器呈现标识、位置与数值。标签关闭 depthTest/depthWrite，保持可读并朝向屏幕；它们不是静态场景贴图。画布内的说明文字采用 text-support，检查器长内容可折行。WebGL 不可用时有文字反馈，数值与公式仍能呈现。

### Loading and recovery

加载圆点使用雾蓝与 1.2s ease-in-out 的透明度动画；停止按钮和错误后的重新加载操作保留在原有会话中。prefers-reduced-motion 禁用动画并取消平滑滚动。错误提示使用浅暖底、砖红文字和 8px 圆角，不使用颜色作为唯一信号。

## Do's and Don'ts

### Do:

- **Do** 使用暖纸、暖灰和炭黑延续现有表面与动作关系。
- **Do** 用雾蓝表示参数或轨迹、灰紫区分对象组、琥珀标识当前选中对象。
- **Do** 保留公式、表格、源码的容器内横向滚动和数值对齐。
- **Do** 保留会话历史行的高度，较长列表在导航内部滚动。
- **Do** 让三维标签在相机缩放时保持屏幕空间尺寸，并用文字和值说明颜色。
- **Do** 保留键盘可见焦点、加载/停止/恢复反馈与减少动态效果支持。

### Don't:

- **Don't** 引入绿色主色、绿色数据角色或绿色装饰。
- **Don't** 用大块彩色背景或强阴影代替教学内容的层次。
- **Don't** 用静态示意图冒充当前实现的可旋转、可点选三维几何。
- **Don't** 让数学、表格或源码的宽度撑开手机页面。
- **Don't** 把当前紧凑的 9–11px 辅助文案提升为通用正文或未来组件的默认字号。

视觉依据：[OpenDesign 官网](https://open-design.ai/) 的浅色面、细边界和留白；其绿色没有采用。frontmatter 取自 frontend/src/index.css、ui 组件、Scene.tsx 及 examples/*.dil 的教学对象色；本次记录没有建立新的深色主题或未实现组件。
