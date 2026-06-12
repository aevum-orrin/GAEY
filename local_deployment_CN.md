# NEGA 本地部署说明(中英混杂 · 给我自己看的)

> 这份是"人话版"。给 VSCode 里 cc 看的是全英文的 `local_deployment.md`,内容一致,
> 两份保持同步即可。

## 这玩意是什么

NEGA 是个**语音对话 AI** 网页应用。技术栈:**Next.js 15 + React 19 + TypeScript +
Tailwind**,语音部分用的是 **ElevenLabs Conversational AI**(`@elevenlabs/react`)。

跑起来的链路:点 "Start conversation" → 浏览器要麦克风权限 → 后端
`app/api/signed-url/route.ts` 去 ElevenLabs 换一个 signed URL → 开始实时语音对话。

## ⚠️ 一个重要纠正:这是 Node 项目,没有 venv

我原本想着"装包就开个 venv 虚拟环境",但 **venv 是 Python 的东西,这个项目是
Node.js,根本用不到 venv**。Node 项目的"环境隔离"本来就有:

- 每个项目自己的 `node_modules/`(天生就是项目级隔离,不是全局安装),
- 再用 **nvm** 把 Node 版本钉死(`.nvmrc`)。

所以本地**别建 venv**,装依赖就是一句 `pnpm install`。包管理器用的是 **pnpm**
(仓库里有 `pnpm-lock.yaml`)。

## 准备工作(只需一次)

- **Node.js 20 LTS**(建议用 nvm 装)
- **pnpm**:`corepack enable` 就有了
- **Git、VSCode**
- 一个能用的**麦克风** + 现代浏览器(Chrome / Edge)
- **ElevenLabs 账号**:用来拿 `AGENT_ID` 和 `XI_API_KEY`(这步只能我自己手动弄,见下)

## 步骤

1. 确认 Node 版本:`node -v` 应该是 v20.x
2. 装依赖:`pnpm install`
3. **配密钥(关键,自动化不了)**:
   - 去 <https://elevenlabs.io> → Conversational AI → 建一个 agent
     (声音 persona 的 prompt 在 `README.md`;`public/American.mp3` 是参考音色样本)
   - 复制 **Agent ID**(`agent_xxxx`);在 Profile 里复制 **API Key**(`sk_xxxx`)
   - 根目录建 `.env`(照着 `.env.example` 的格式):
     ```
     AGENT_ID=agent_你的ID
     XI_API_KEY=sk_你的Key
     ```
   - `.env` 已被 gitignore,**绝对不要提交**
4. 跑起来:`pnpm dev` → 打开 http://localhost:3000 → 点 Start conversation → 允许麦克风
5. 验证能不能 build(项目**没有**测试用例):
   ```
   pnpm lint
   pnpm build
   ```
   lint 过 + build 成功 + 页面能渲染出来(头像、Disconnected、Start 按钮),
   就算"没密钥也能验证"的成功标准。

## 心里要有数的几点

- 这个项目**本身基本就能跑了**,真正缺的只有 `.env` 里那两个密钥 + 本地环境。
  所以 cc 要"配置"的东西其实不多,主要是:钉 Node 版本(`.nvmrc`)、检查 gitignore、
  scaffold 一个空的 `.env`、更新文档、跑 build 验证 —— **不需要大改 main 里的源码**。
- **语音对话本身没法被 cc 自动测**:它要真麦克风 + 真密钥。cc 顶多验证到"能编译、
  页面能渲染";真正开口对话还得我本地自己点一遍。
- **别瞎 gitignore**:`public/avatar.png`(UI 在用)和 `public/American.mp3`
  (音色样本)是**要保留**的,不是垃圾大文件。真正不该传的是 `.env`、`node_modules/`、
  `.next/`(这些 gitignore 里已经有了)。

## 常见问题

- 报 `AGENT_ID is not set` / signed-url 返回 500 → `.env` 没建或没生效,
  建好后**重启** `pnpm dev`
- "Failed to get signed url" → key 错了/过期,或 agent 没开 signed URL
- 没弹麦克风权限 → 浏览器把麦克风禁了,或没走 localhost
- build 报 engine/版本错 → Node 版本不对,`nvm use` 切到 20

## 约定(和给 cc 的英文版一致)

- 代码和代码注释:**全英文**(注释精简)
- 每次有意义的修改就 **commit 一次**,暂时**不 push**
- commit 署名:author 用 **aevum-orrin**,带 `Co-Authored-By: Claude` trailer,
  这样两个都算 contributor
