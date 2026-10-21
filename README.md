# 法律AI助手-小卢

面向法律场景的 AI 对话客户端。基于 Vue 3、Vite 和 Electron，通过兼容 Agnes API 的服务完成流式对话；既可运行在浏览器中，也可打包为 Windows 桌面应用。

> **免责声明**：本工具生成的内容仅用于法律信息参考和辅助工作，不构成正式法律意见，也不能替代执业律师的专业判断。涉及具体案件、合同签署或诉讼决策时，请务必由具备资质的法律专业人士复核。

## 功能

- 基础问答：日常问题解答与信息整理，要求先给结论、再给依据，不确定时明确说明。
- 文档阅读：支持上传 PDF、DOCX、TXT、Markdown、CSV、JSON 文档（最大 20MB，超长内容截取前 6 万字），自动提取文本并总结主要内容。
- 法律顾问：面向法律问题的专业分析，要求法条、司法解释和案例均给出可核查来源（名称 + 条款号/案号）；无法确认时强制标注“待核实”，不得编造来源。注意：应用当前不具备联网检索能力，引用仍需在国家法律法规数据库、最高人民法院官网等权威渠道复核。
- 多会话管理：支持新建、切换和删除本地会话，会话标题随首条消息自动生成。
- 本地配置与数据：API Key、API 地址和对话记录保存在浏览器 `localStorage` 中。
- Windows 桌面端：提供 Electron 开发启动与 Windows x64 打包脚本，桌面端支持系统托盘与原生菜单。

## 适用场景

- 法律概念、程序流程与条文含义的辅助理解。
- 合同条款的风险点梳理与修改思路讨论。
- 案件事实整理、争议焦点归纳和分析框架搭建。
- 法律文书初稿撰写与措辞优化。
- 法规检索方向建议（具体条文与时效请以官方发布为准）。
- 上传合同、判决书、协议等文档，快速获取摘要与风险点提示。

## 技术栈

- Vue 3（Composition API）
- Vite 6
- Electron 41
- 原生 Fetch API 与 Server-Sent Events（SSE）
- `marked`（渲染对话中的 Markdown）
- `pdfjs-dist`、`mammoth`（提取 PDF / DOCX 文本）

## 环境要求

- Node.js 18 或更高版本。GitHub Actions 当前使用 Node.js 24 构建。
- 可访问一个实现下列接口的 Agnes API 兼容服务，并拥有有效的 Bearer Token。

## 快速开始

安装依赖并启动浏览器开发服务器：

```bash
npm install
npm run dev
```

开发服务器固定监听 `http://localhost:3000`。端口已配置为严格模式，若被占用，Vite 会退出而不是自动选择其他端口。

首次启动后，打开“设置”页面，填写 API Key；可按需填写 API 地址并使用“测试连接”验证凭据。

## 可用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器（端口 3000）。 |
| `npm run build` | 构建 Web 静态文件到 `build/`。 |
| `npm run preview` | 本地预览已构建的 Web 静态文件。 |
| `npm run electron:dev` | 并行启动 Vite 和 Electron 开发窗口。 |
| `npm run electron:build` | 先构建 Web 文件，再使用 `electron-packager` 产出 Windows x64 应用到 `dist/`。该命令会清理其指定的旧打包输出目录。 |

## API 配置与运行差异

默认 API 地址为 `https://api.agnes-ai.cn/v1`，认证方式为：

```http
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

开发环境下，所有 `/api/*` 请求都会由 Vite 转发到 `https://api.agnes-ai.cn/v1/*`。因此，浏览器开发模式不会使用设置页中的自定义 API 地址。

生产 Web 构建和 Electron 环境会直接使用设置页中的 API 地址。自托管 Web 版本时，目标 API 必须允许浏览器跨域请求（CORS）；更推荐由自己的服务端代理请求。

客户端调用的接口及预期用途如下：

| 方法与路径 | 用途 |
| --- | --- |
| `GET /models` | 测试 API Key 是否可用。 |
| `POST /chat/completions` | 使用 SSE 获取流式对话结果。 |

对话默认使用 `agnes-2.5-flash`；所用服务需支持该模型名，或需要相应调整源码。

## 数据与安全

- API Key 及对话记录保存在当前浏览器配置文件的 `localStorage`，没有加密，也不会同步到项目服务器。
- 上传的文档会在本地提取纯文本后随消息发送给 API 服务，并保存在本地会话记录中；请先脱敏。
- 请求遇到网络错误或 `429`、`502`、`503`、`504` 时，客户端会做最多 3 次指数退避重试。
- 请勿在对话中提交身份证号、住址、银行账户等敏感个人信息；确需处理真实案件材料时，应先做脱敏。
- 请勿将真实 API Key 写入源码、构建产物或公开仓库。当前代码中存在默认密钥回退逻辑，公开部署前应删除该逻辑，并撤销任何已暴露的密钥。

## 项目结构

```text
.
|- src/
|  |- api/                 # 通用请求封装与对话接口
|  |- components/          # 布局、对话、设置及通用组件
|  |- composables/         # 全局状态、角色提示词和业务流程
|  |- utils/               # PDF / DOCX 等文档文本提取
|  |- electron/            # Electron 主进程与预加载脚本
|  |- images/              # 内置图标
|  |- App.vue
|  `- main.js
|- styles/main.css          # 全局样式
|- vite.config.js           # Vite、开发服务器及 API 代理配置
`- .github/workflows/ci.yml # master 分支的构建与 GitHub Pages 部署
```

## 构建与部署

执行 `npm run build` 后，静态文件位于 `build/`。仓库中的 GitHub Actions 会在 `master` 分支推送时构建该目录并发布到 `gh-pages` 分支。

由于静态站点会在访问者浏览器中直接请求 API，部署前应确认 CORS、密钥保护和服务访问策略。GitHub Pages 不适合承载需要私密 API Key 的生产应用。

## 开发说明

- 角色提示词位于 `src/composables/useAppStore.js` 的 `chatRoles`，可按法律业务方向调整名称、描述和 `systemPrompt`。
- 代码中的文本以 UTF-8 保存。若终端显示中文乱码，请检查终端的编码设置，而不是修改源文件编码。
- 项目未提供自动化测试脚本；提交前至少执行 `npm run build` 以验证生产构建。
- 仓库当前未声明许可证；复用或发布前请先补充明确的许可条款。
