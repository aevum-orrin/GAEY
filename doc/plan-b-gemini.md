# Plan B — Gemini 语音方案 (Google AI Studio / Gemini Live API)

> **定位 / Role:** 用 **Gemini** 替代 ElevenLabs 做语音对话。**改动小、能上 Vercel、不需要 GPU**,是介于"继续用 ElevenLabs"和"Plan A 全自托管"之间最省事的一条路。
>
> 价格/额度信息为 **2026‑06** 口径,**务必以官网实时为准**(Google 改得很勤)。

---

## 0. ⚠️ 先把"额度"这件事说清楚 / Read this first

你问"**我有 Google AI Studio Pro 会员,Gemini 语音额度有多少**"。关键澄清:

> **消费端订阅(Google AI Pro,$19.99/月)≠ Gemini API 额度。两者分开计费。**
> Google 甚至已经**取消了**原来 AI Pro 附带的每月 1,000 AI credits。

所以"语音额度"要分两种理解:

| 你说的"额度" | 指什么 | 对 GAEY 有用吗 |
| --- | --- | --- |
| (a) 你在 **Gemini App** 里语音聊天 | 你的 **Pro 会员**给的 in-app 高额度 | ❌ **用不上**——那是 App,不是 API |
| (b) **GAEY(你的 app)调 Gemini API** | **Gemini Developer API** 的免费层 / 按量付费 | ✅ 这才是 GAEY 要用的 |

**结论:** 给 GAEY 接语音,走的是 **Gemini API**,跟你那个 $19.99 会员**基本无关**。你需要的是一个 **AI Studio 的 API key**,然后吃 API 的**免费层**,或开**按量付费 (pay-as-you-go)**。

---

## 1. GAEY 该用的产品:Gemini Live API

- **Gemini Live API** = 实时、低延迟、**双向语音**(WebSocket),正好对标 ElevenLabs Conversational AI 的能力。
- 模型如 **Gemini 2.5 Flash native audio**:听你说话(STT)、思考(LLM)、用自然语音回你(TTS)一条龙,**和 ElevenLabs 一样是"一条托管管线"**。

### 计费模型 / Billing(按 token)
- 音频 tokenize:**input ≈ 32 tokens/秒**,**output ≈ 25 tokens/秒**。
- 按 input/output token 单独计价(音频 token 比文本贵)。
- **粗略每分钟估算**(数量级,**以官网为准**):约 **$0.01–0.03 / 分钟 ≈ 每小时 ~$1–1.5**。
  → 数量级上**明显比 ElevenLabs 便宜**(ElevenLabs ~$5–7/小时)。

### 免费层 / Free tier(2026‑06)
- **Gemini 2.5 Flash native audio 在免费层可用**(有自己的 RPM/TPM 限制),足够开发联调。
- 通用免费层量级:约 **5–15 RPM、~100–1,500 RPD**(随模型而定);**2026‑04 起 Pro 系模型移出免费层**,Flash/Flash-Lite 保留。
- 免费层适合**自己测试**;一旦给真实用户用,基本要开**按量付费**(但单价低)。

> 想拿**精确**的 Live API 免费层 RPM/RPD 和每 token 单价,去 AI Studio 的 **Rate limits / Pricing** 页或 `ai.google.dev/gemini-api/docs/{rate-limits,pricing}` 看实时数字。

---

## 2. 架构 / Architecture(本方案最大卖点:几乎契合现有 GAEY)

现在 GAEY 的流程:
```
浏览器 → /api/signed-url(用 XI_API_KEY 换 ElevenLabs signed URL)→ 浏览器直连 ElevenLabs WS
```
改成 Gemini,**结构几乎一模一样**:
```
浏览器 → /api/gemini-token(用 GEMINI_API_KEY 换 ephemeral token)→ 浏览器用 @google/genai 直连 Gemini Live API WS
```

- **ephemeral token(短时令牌)** 是 Google 专门为浏览器端安全连 Live API 提供的:服务端用真 API key 换一个短时令牌,浏览器拿令牌直连,**真 key 不下发到前端**——和现在的 signed-url 套路一一对应。
- 这是**小改,不是重写**:`ConvAI.tsx` 的 UI 全保留,只换"实时客户端"那一层。

> ✅ **部署 / Deployment:天然适合 Vercel。** `/api/gemini-token` 就是个 serverless function(和现在的 `/api/signed-url` 一样),浏览器直连 Google,**没有常驻后端、不需要 GPU**。这是相对 Plan A 的巨大优势。

---

## 3. 这个代码库要改什么 / Codebase changes

| 区域 Area | 改动 Change |
| --- | --- |
| `ConvAI.tsx` 的 UI(transcript / 语速滑块 / 波形 / 状态) | **保留 Keep** |
| `app/api/signed-url/route.ts` | **改写 Rewrite** 为 `app/api/gemini-token/route.ts`(用 `GEMINI_API_KEY` 换 ephemeral token) |
| `@elevenlabs/react` 的 `useConversation()` | **替换 Replace** 为基于 **`@google/genai`** 的 Live 客户端 hook(连 WS、推麦克风音频、收音频与 transcript、发同款事件) |
| env `AGENT_ID` / `XI_API_KEY` | **换成 Replace** `GEMINI_API_KEY` + 模型/voice 配置 |
| 语速 speed slider | **重新映射 Remap** 到 Gemini 的语音/speaking-rate 配置(机制和 ElevenLabs 不同,需适配) |
| 依赖 deps | 去掉 `@elevenlabs/*`,加 `@google/genai` |

> persona / first message / voice 选择:从 ElevenLabs Dashboard **搬到代码里的 Live API session 配置**(system instruction + voice 名)。这点和现在"配置在 Dashboard"的模型不同,要注意。

---

## 4. 里程碑 / Milestones

- **M-B1(~1–2 天):** `/api/gemini-token` 跑通;浏览器用 `@google/genai` 拿令牌、建立 Live 连接、能听到 Gemini 说话。
- **M-B2(~1–2 天):** 写 `useGeminiConversation()`,对齐现有 hook 接口(status / isSpeaking / onMessage),让 transcript / 波形 / 状态灯复用。
- **M-B3(~1 天):** system prompt(GAEY persona,见 `PLAN.md` §7)、voice 选择、语速映射、错误/重连处理。

**合计 / Total:** **~2–4 天**出可用版本(因为架构契合 + Google SDK 已封装实时管线,类似 ElevenLabs SDK 的省心程度)。比 Plan A 小一个数量级。

---

## 5. 横向对比 / How it stacks up

| 维度 | ElevenLabs(现状) | **Plan B — Gemini** | Plan A — 自托管 |
| --- | --- | --- | --- |
| 改造工作量 | 0 | **小(~2–4 天)** | 大(~3–4 周) |
| 能上 Vercel | ✅ | ✅ | ❌(后端要本地/GPU) |
| 需要 GPU | 否 | 否 | 建议要 |
| LLM 质量 | 强(Gemini 等) | **强(Gemini)** | 中(本地 8B–70B) |
| 语音自然度 | 最好 | 不错且在进步 | 一般(Kokoro 最佳折中) |
| 边际成本 | ~$5–7/小时 | **~$1–1.5/小时(估)** | ~$0(电费/硬件除外) |
| 免费层 | ~15 分钟/月 | Flash 免费层(RPM/RPD 受限) | 无需(全本地) |
| 隐私/离线 | 否 | 否 | ✅ |

---

## 6. 验收 / Acceptance

- [ ] `/api/gemini-token` 返回有效 ephemeral token;真 `GEMINI_API_KEY` 不出现在前端。
- [ ] 点 Start 能和 Gemini 语音来回对话;transcript 双方都显示。
- [ ] GAEY persona(system instruction)生效,口吻符合 `PLAN.md` §7。
- [ ] 语速滑块实际改变语速。
- [ ] 部署到 Vercel 后功能正常(serverless token 路由 + 浏览器直连)。

## 7. 风险 / Risks

- **免费层限流**(RPM/RPD)对多用户不够 → 上线需按量付费(但便宜)。
- **Live API 仍在演进**:模型名/voice/定价/SDK 接口可能变,落地前对一遍官方文档。
- **ephemeral token 安全**:设置合理的 TTL 与使用次数上限。
- **会员认知误区**:别误以为 $19.99 的 Pro 会员能让 GAEY"免费用 Gemini API"——见 §0。
