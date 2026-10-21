# 法律AI助手-小卢

基于 Vue 3、Vite 和 Electron 的 AI 对话客户端，可通过兼容 Agnes API 的服务完成流式对话。项目既可作为浏览器应用运行，也可打包为 Windows 桌面应用。

> 本项目直接从客户端调用 API，适合个人使用和原型验证。部署给不受信任的用户前，请先增加后端代理和鉴权层，避免暴露 API Key。

## 功能

- 对话：通过 SSE 接收流式回复，支持新建、切换和删除本地会话。
- 对话角色：新建会话时可选择普通对话、提示词助手、视觉导演、视频分镜师或品牌文案师；角色会随会话保存。
- 本地配置与数据：API Key、API 地址和对话记录保存在浏览器 `localStorage` 中。
- Windows 桌面端：提供 Electron 开发启动与 Windows x64 打包脚本，桌面端支持系统托盘与原生菜单。

## 技术栈

- Vue 3（Composition API）
- Vite 6
- Electron 41
- 原生 Fetch API 与 Server-Sent Events（SSE）
- `marked`（渲染对话中的 Markdown）

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
- 请求遇到网络错误或 `429`、`502`、`503`、`504` 时，客户端会做最多 3 次指数退避重试。
- 请勿将真实 API Key 写入源码、构建产物或公开仓库。当前代码中存在默认密钥回退逻辑，公开部署前应删除该逻辑，并撤销任何已暴露的密钥。

## 项目结构

```text
.
|- src/
|  |- api/                 # 通用请求封装与对话接口
|  |- components/          # 布局、对话、设置及通用组件
|  |- composables/         # 全局状态和业务流程
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

- 代码中的文本以 UTF-8 保存。若终端显示中文乱码，请检查终端的编码设置，而不是修改源文件编码。
- 项目未提供自动化测试脚本；提交前至少执行 `npm run build` 以验证生产构建。
- 仓库当前未声明许可证；复用或发布前请先补充明确的许可条款。
