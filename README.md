# GAEY

> English version: see [`README_EN.md`](./README_EN.md)

**GAEY** 是一个语音对话 AI，帮中国留学生（以及任何想学美式英语的人）听懂、
学会**地道的日常美式口语**——流行语、俚语、习惯表达——方法很简单：就像和
朋友聊天一样跟它说话。

很多同学英语很好，但面对美国人之间随口说的俚语、流行梗、口头语还是会一脸懵。
GAEY 想做的就是一个零压力、像朋友一样的练习对象：语气友好、说真实的口语、
**不带很多脏话、不针对某一种口音做夸张模仿、也不会骂人**，就是平时朋友之间
那样自然地聊天。

> GAEY is built on **NEGA**（本仓库 fork 自 NEGA 项目）。NEGA 是一个很扎实的
> ElevenLabs 对话 AI 模板，GAEY 沿用了它干净的技术底座，把人设换成了"友好、
> 教你真实美式口语"的版本。

完整规划见 [`PLAN.md`](./PLAN.md)；给 AI 助手看的项目说明见
[`CLAUDE.md`](./CLAUDE.md)。

## 它是怎么工作的

这个网页本身**不含任何 AI 模型**，它是 **ElevenLabs Conversational AI** 的一个
轻量客户端：

1. 浏览器向本地的 `/api/signed-url` 请求一个临时签名地址（用 `AGENT_ID` 和
   `XI_API_KEY` 生成）。
2. 客户端用这个地址建立实时语音连接（麦克风 + 音频）。
3. **大模型（如 Gemini 2.5 Flash）、语音识别、语音合成全部在 ElevenLabs 云端
   运行。**

所以 AI 的**人设、声音、模型、语速**都是在 **ElevenLabs 后台**配置的，不在代码里。
（要把"脏话太多/口音太重"改掉，是去后台改提示词和换声音，不是改代码。）

## 软硬件要求 & 花不花钱

- **跑这个网页是免费的**，开源，代码里没有任何收费点。
- 唯一的成本来自 **ElevenLabs**：有**免费额度**（截图里的免费工作区有 1 万
  credits），但语音对话**按分钟消耗 credits**，用得多就需要付费套餐。
- **不需要 GPU，永远不需要。** 你不会在本地跑模型——模型、语音识别、语音合成
  都在 ElevenLabs 服务器上。
- 只需要：一台普通电脑、Node.js 18+、一个包管理器、带**麦克风**的现代浏览器、
  以及网络。
- "换模型/换人设要不要 GPU？" —— 不要。换模型只是在后台**下拉框里选**另一个大
  模型；换人设只是**改一段提示词**；换声音/语速只是**后台设置**。都不动本地算力。

## 本地运行

复制 `.env.example` 为 `.env`，填入你自己的 ElevenLabs 配置：

```
AGENT_ID=        # 你的 ElevenLabs Agent ID
XI_API_KEY=      # 你的 ElevenLabs API Key（仅服务端使用）
```

然后：

```bash
pnpm install
pnpm dev
# 打开 http://localhost:3000
```

（也可以用 npm / yarn / bun 对应的命令。）

## 配置你自己的 GAEY Agent

详见 `doc/` 目录下的图文教程。核心是在 ElevenLabs 后台：新建一个 Agent，填入
GAEY 的**系统提示词**和**开场白**（推荐文案见 [`PLAN.md`](./PLAN.md) 第 7 节），
选一个友好的声音，把语速设成适合学习的速度，然后把 Agent ID 和 API Key 填进
`.env`。

## 了解更多

- [Conversational AI Tutorial](https://elevenlabs.io/docs/product/introduction)
- [Conversational AI SDK](https://elevenlabs.io/docs/libraries/conversational-ai-sdk-js)
