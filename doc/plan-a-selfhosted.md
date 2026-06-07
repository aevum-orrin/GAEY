# Plan A — 保底方案:Self-hosted (Whisper + Ollama + Kokoro)

> **定位 / Role:** 这是 GAEY 的 **保底 / fallback plan** —— 完全本地、零边际成本、可离线、数据不出本机。代价是要自己跑三个模型、对硬件有要求、音质与延迟要权衡。
>
> 详细可行性分析见 `doc/cost-and-self-hosting.md` Part 2;本文是**可执行的实施计划**。
> 价格/型号信息为 **2026‑06** 口径,以官网为准。

---

## 1. 什么时候选这条路 / When to pick this

- ✅ 想要 **零按量费用**、**隐私**(音频不出本机)、**离线**可用。
- ✅ 手上有像样的机器(尤其 GPU 或 Apple Silicon),你说过**更大参数模型也有 access**。
- ❌ 不适合追求"开箱即用、最省事、最好音质"——那是 ElevenLabs / Plan B 的强项。

> ⚠️ **部署现实 / Deployment:** 这套后端**不能跑在 Vercel 上**。Vercel 是 serverless:没有 GPU、函数有执行时长上限、不能常驻一个 Ollama 进程。所以:
> - **前端 (Next.js)** 可以照旧上 Vercel;
> - **语音后端 (VAD+Whisper+Ollama+Kokoro)** 必须跑在**你自己的机器 / 自管 GPU 服务器**上;
> - 想从外网访问本地后端,用隧道(Cloudflare Tunnel / ngrok)把本地 WS 暴露给前端。
> - 最省心的做法:**整套本地跑**(前端也 `pnpm dev` / `pnpm start` 本地),不上 Vercel。你说"本地也行",Plan A 就走本地。

---

## 2. 架构 / Architecture

```
浏览器 Browser (Next.js, 现有 UI 基本不动)
   │  mic audio ▲ transcript + TTS audio
   ▼          │
本地语音后端 Local voice backend (新增 / new — Python FastAPI 或 Node + WebSocket)
   ├─ Silero VAD     → 断句 endpointing / 检测打断 barge-in
   ├─ Whisper (STT)  → faster-whisper(推荐)或 whisper.cpp
   ├─ Ollama (LLM)   → Llama 3.1 8B(默认)/ 更大模型,streaming
   └─ Kokoro (TTS)   → 自然美音,CPU 可跑;备选 Piper
```

核心认知:ElevenLabs 把"一条实时管线"藏在一个 WebSocket 后面;本方案要**自己把这条管线拼出来**(三个模型 + 串它们的胶水 + 状态机)。

---

## 3. 选型与硬件 / Components & hardware

### STT — Whisper
- **faster-whisper**(CTranslate2,推荐)或 **whisper.cpp**(纯 CPU,GGML)。
- 模型:`base.en` / `small.en` 在 CPU 上延迟可接受;`distil-large-v3` / `large-v3` 想流畅要 GPU。
- 做法:用 VAD 切句,每句说完再转写;真正的 streaming partial 转写是额外工作量。

### LLM — Ollama
- 通过 Ollama 跑本地模型,自带 **OpenAI 兼容** `/v1/chat/completions`(streaming)和原生 `/api/chat`。
- **默认 / default:** **Llama 3.1 8B Instruct**(延迟最稳,适合实时对话)。
- **你有大模型 access → 质量档 / quality tier:** 显存够就上更大的,教俚语/纠错更靠谱:

  | 模型 Model | 量化 Quant | 大致显存 ~VRAM | 备注 |
  | --- | --- | --- | --- |
  | Llama 3.1 8B / Qwen2.5 7B | Q4 | ~6–8 GB | 默认,延迟好 |
  | Qwen2.5 32B | Q4 | ~20–24 GB | 明显更聪明 |
  | Llama 3.1 70B / Qwen2.5 72B | Q4 | ~40–48 GB | 接近云端体验,需 1×48G 或 2×24G / A100 |

  > 经验法则:**对话场景延迟比"再聪明一点"更重要**。建议默认 8B 跑顺,再按机器能力往上调;大模型可作为"质量模式"开关。
- ⚠️ 即便 70B,本地模型在**最新俚语/文化梗**上仍可能不如云端 Gemini 2.5 Flash;但日常口语陪练完全够用。

### TTS — Kokoro(本方案的关键体验)
- **Kokoro**(推荐):82M、Apache 协议、**自然美音**(如 `af_heart` / `am_*` 系列)、CPU 也能近实时。学发音首选。
- **Piper**(备选):更快更轻,弱机/低延迟优先;音色略机械。
- 语速:Kokoro / Piper 都支持 speed 参数 → 现有 UI 的语速滑块直接映射过去。

---

## 4. 难点 / The hard parts(为什么不是一个周末)

1. **断句 VAD / endpointing** —— 判断学习者说完没(现在 ElevenLabs 服务端帮你做)。
2. **流式低延迟 streaming** —— 别"录完→STT→等整段 LLM→等整段 TTS→播";要流式 LLM → 按句切 → 逐句 TTS → 边出边播。
3. **打断 barge-in** —— 用户一开口,GAEY 立刻闭嘴。
4. **回声消除 echo cancellation** —— 别让麦克风听到 GAEY 自己的声音(戴耳机基本解决)。
5. **编排状态机 orchestration** —— idle → listening → thinking → speaking →(interrupt),并发出 UI 需要的同款事件。
6. **打包 packaging** —— 让非程序员也能跑(装 Ollama、拉模型、Python 环境 / Docker、下载语音)。

---

## 5. 这个代码库要改什么 / Codebase changes

好消息:**UI 几乎不动。** `components/ConvAI.tsx` 只依赖一个很小的接口(`status` / `isSpeaking` / `startSession` / `endSession` / `onMessage({ role, message })`)。

| 区域 Area | 改动 Change |
| --- | --- |
| `ConvAI.tsx` 的 UI(transcript / 语速滑块 / 波形 / 状态) | **保留 Keep** |
| `@elevenlabs/react` 的 `useConversation()` | **替换 Replace** 为自写 `useLocalConversation()`(AudioWorklet 采麦、WS 协议、播放队列、同款事件) |
| `app/api/signed-url/route.ts` | **删除 Remove**(不再签 URL,改连/代理本地后端 WS) |
| 语音后端服务 backend | **全新增 Add**(VAD + Whisper + Ollama + Kokoro + 流式编排) |
| env `AGENT_ID` / `XI_API_KEY` | **换成 Replace** 后端地址 + 模型/语音配置 |

---

## 6. 里程碑 / Milestones

- **M-A1 PoC(~3–5 天):** push-to-talk(推杆即说)、顺序执行、无打断;`useLocalConversation()` 走通一来一回("它会回话")。
- **M-A2 实时化(~1–1.5 周):** VAD 断句 + LLM 流式 + 逐句 TTS + 播放队列,延迟降到可对话。
- **M-A3 打磨(~1 周):** barge-in、回声/错误处理、重连、语速滑块接通、质量模式(大模型开关)。
- **M-A4 打包(~3 天):** Docker Compose / 一键脚本(Ollama 拉模型 + Python 环境 + 语音下载),写运行文档。

**合计 / Total:** PoC ~3–5 天;接近生产 **~3–4 周**(一个熟练全栈)。

---

## 7. 验收 / Acceptance

- [ ] 本地启动:`ollama serve` + 后端 + 前端,点 Start 能正常对话。
- [ ] 端到端延迟:用户说完到 GAEY 开口 < ~1.5s(实时档)。
- [ ] barge-in 生效;戴耳机无回声自激。
- [ ] 语速滑块实际改变 GAEY 语速。
- [ ] transcript 双方都显示(复用现有 UI)。
- [ ] 非程序员按文档能跑起来。

## 8. 风险与权衡 / Risks

- **硬件/电费**:流畅 LLM 要 GPU/Apple Silicon;弱机会卡。
- **音质**:开源 TTS 不错但目前仍不如 ElevenLabs 自然(对学发音是减分项,Kokoro 已是最佳折中)。
- **工作量**:实时管线是真功夫,别低估 M-A2/M-A3。
- **建议**:先做 **M-A1 PoC** 验证体感,再决定是否投入完整实时重写。
