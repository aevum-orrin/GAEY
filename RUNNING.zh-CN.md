# 怎么运行 GAEY（中英混杂版）

从零把 GAEY 在自己电脑上跑起来的完整指南。English version: [`RUNNING.md`](./RUNNING.md).

GAEY 本身**不含任何 AI 模型**，它只是 **ElevenLabs Conversational AI** 的一个网页
客户端：大模型（LLM）、语音识别、语音合成全在 ElevenLabs 云端跑。所以配置分两部分：
**(A)** 在 ElevenLabs 网站建好你的 agent，**(B)** 跑起这个网页并连到那个 agent。

## 准备工作 Prerequisites

- 一台普通电脑（Windows / macOS / Linux），**不需要 GPU**。
- **Node.js 18+** 和一个包管理器（推荐 **pnpm**）。
- 带**麦克风**的现代浏览器（Chrome / Edge / Safari），加上音箱或耳机。
- 能联网。
- 一个**免费的 ElevenLabs 账号**（https://elevenlabs.io）。

## Part A — 在 ElevenLabs 网站建你的 GAEY agent

这一步只做一次，**必须在 ElevenLabs 网站上做**（代码里做不了）。`doc/` 目录里有每一步
的截图教程。

1. 去 https://elevenlabs.io **注册 / 登录 Sign up / log in**。
2. 进 **Agents** 平台 → **Agents** → **New agent**（新建 agent）。
3. 在 **Agent** 标签页，把 [`doc/agent-prompt.md`](./doc/agent-prompt.md) 里的
   **system prompt（系统提示词）** 和 **first message（开场白）** 粘进去。这就是让
   GAEY"友好、说地道俚语、不带脏话"的关键。
4. **Voice（声音）**：选一个友好、年轻的美式声音（Voice Library 或 Voice Design 都行）。
   **Language（语言）** 选 English。**LLM** 用 Gemini 2.5 Flash 就很好。
5. **Speed（语速，可选）**：在 **Voice** 标签页把默认语速设成适合学习的值（~0.9–1.0）。
6. **打开 speed 覆盖开关**：在 **Security → Overrides** 里把 **speed** 打开。
   ⚠️ 网页里的语速滑块要生效，**必须**打开这个，否则滑块没反应。
7. 复制你的 **Agent ID**（在 agent 页面顶栏）。
8. 建一个 **API key**：去 **Developers → API Keys → Create Key**，复制下来。
   （这个 key 当密码一样保管，别泄露、别提交到 git。）

## Part B — 跑起网页 app

1. **拿到代码**并切到工作分支：

   ```bash
   git clone <你的-fork-地址> GAEY
   cd GAEY
   git checkout gaey-test
   ```

2. **装依赖 Install dependencies**：

   ```bash
   pnpm install
   ```

3. **配置环境变量**。复制示例文件，把 Part A 拿到的两个值填进去：

   ```bash
   cp .env.example .env
   ```

   ```
   AGENT_ID=你的-elevenlabs-agent-id
   XI_API_KEY=你的-elevenlabs-api-key
   ```

   `.env` 已经在 `.gitignore` 里，**千万别 commit 上去**。

4. **启动开发服务器**：

   ```bash
   pnpm dev
   ```

   打开 http://localhost:3000。

5. 点 **Start conversation**，浏览器问的时候**允许麦克风权限**，然后就可以开口说了。
   页面会实时显示**双方对话字幕**，你也可以拖 **speech-speed（语速）** 滑块调 GAEY 说话
   的快慢。

## 生产构建 Production build（可选）

```bash
pnpm build
pnpm start
```

## 常用命令 Useful commands

| 命令 Command | 作用 |
| --- | --- |
| `pnpm install` | 装依赖 |
| `pnpm dev` | 跑开发服务器（http://localhost:3000）|
| `pnpm build` | 生产构建 |
| `pnpm start` | 启动生产版 |
| `pnpm lint` | 跑 ESLint |

## 常见问题 Troubleshooting

- **"Failed to get signed url" / 连不上。** 检查 `.env` 里的 `AGENT_ID` 和
  `XI_API_KEY` 是否填对，改完 `.env` 要**重启 `pnpm dev`**。
- **没声音 / 麦克风没反应。** 确认在浏览器里允许了麦克风权限，系统的输入/输出设备选对。
  浏览器只在 `http://localhost` 或 HTTPS 下才给麦克风权限。
- **语速滑块好像没用。** 去 agent 的 **Security → Overrides** 打开 **speed** 覆盖
  （Part A 第 6 步）。滑块是在你**开始对话时**生效，不是对话中途实时改。
- **提示 credits 用完了。** ElevenLabs 语音对话按分钟烧 credits，免费额度有限，用得多
  要买套餐。
- **GAEY 说脏话 / 像在模仿某种口音。** 那是**人设**问题，人设在后台、不在代码里。去改
  system prompt（见 `doc/agent-prompt.md`）或者换个声音。
