# Cost & a fully self-hosted (free) alternative

> Companion to `PLAN.md` §4 ("Cost, hardware & do I need a GPU?").
> Two questions answered here:
> 1. **How far does the ElevenLabs free tier go, and when do you pay?**
> 2. **What would a 100% free, self-hosted pipeline (Whisper + Ollama +
>    open-source TTS) look like, and how much work is it to build?**
>
> Pricing figures are **as of June 2026** — always confirm on the live
> ElevenLabs pricing page, they change often. ElevenLabs has renamed
> "Conversational AI" to **"ElevenLabs Agents"**; same product.

---

## Part 1 — ElevenLabs cost: free-tier budget & when you start paying

### How billing works here

GAEY is a **thin client**: the app is free and open source, but every
minute of conversation runs the LLM + speech-to-text + the voice (TTS) on
ElevenLabs' servers, billed from your ElevenLabs account. So "do I pay?"
is entirely a function of **how many minutes you talk per month**.

### The free tier

- **10,000 credits / month**, which is **≈ 15 minutes** of agent
  conversation (ElevenLabs' own headline figure for the free plan).
- **Hard stop:** on **Free and Starter** there is **no overage** — when
  the monthly credits run out, conversations simply stop until the next
  monthly reset (resets on your signup day each month).
- Great for trying it out / a demo. **Not enough for daily practice**
  (15 min/month is ~30 seconds a day if you spread it out).

### What it costs once you pay

ElevenLabs Agents is billed **per minute**, and the per-minute rate
**includes a bundled LLM + voice**:

| Tier | Bundled models (illustrative) | Price |
| --- | --- | --- |
| Standard | gpt-3.5-turbo + Multilingual v2 voice | **$0.08 / min** |
| Turbo | gpt-4o-mini + Flash v2 voice | **$0.10 / min** |
| Premium | gpt-4o + Flash v2.5 voice | **$0.12 / min** |

So roughly **$5–7 per hour of actual talking**. (Caveat: if you wire in a
premium / bring-your-own LLM, that model's cost can be passed through on
top of the per-minute voice charge.)

### The plan ladder (approx, June 2026)

| Plan | Price/mo | Credits/mo | Overage? |
| --- | --- | --- | --- |
| Free | $0 | 10,000 (≈15 min) | No (hard stop) |
| Starter | ~$5 | 30,000 | No (hard stop) |
| Creator | ~$22 | 100,000 | Yes (usage-based unlocks) |
| Pro | ~$99 | 500,000 | Yes |
| Scale | ~$330 | ~2,000,000 | Yes |
| Business | enterprise | ~11,000,000 | Yes (~$0.08/min annual) |

Paid **subscriptions bundle a monthly minute allowance** that is usually
cheaper per minute than pure pay-as-you-go, and (from Creator up) let you
keep going past the allowance at the per-minute rate.

### What that means for *your* use (daily English practice)

Rough monthly cost at ~$0.08–0.12/min:

| Your habit | ≈ min / month | ≈ cost / month |
| --- | --- | --- |
| Free tier only | 15 | **$0** (then it stops) |
| 5 min/day | ~150 | ~$12–18 |
| 15 min/day | ~450 | ~$36–54 |
| 30 min/day | ~900 | ~$72–108 |

**Takeaway:** the free tier is a *taster*, not a daily-practice budget.
For real daily speaking practice, plan on **a few dollars per hour** of
conversation. For a learner, the natural, real-sounding American voice is
exactly what helps your ear and pronunciation — so this is arguably the
one place worth spending on. A practical sweet spot is **Starter/Creator
+ watching your minutes**, upgrading only if you genuinely talk a lot.

---

## Part 2 — A 100% free, self-hosted pipeline

### The core realization

ElevenLabs sells you **one managed real-time pipeline** behind a single
WebSocket. Going free means **rebuilding that pipeline yourself** out of
**three separate local models plus the glue that streams between them**:

```
                ┌─────────────── what ElevenLabs does for you today ───────────────┐
  mic ─▶ VAD/turn-taking ─▶ STT ─▶ LLM ─▶ TTS ─▶ streamed audio ─▶ speakers
                └──────────── all behind @elevenlabs/react useConversation() ───────┘
```

Today, **`useConversation()` in `components/ConvAI.tsx` hides all of
this**: mic capture, voice-activity detection / knowing when you stopped
talking, STT, the LLM turn loop, TTS, streaming playback, barge-in
(interrupting the agent), and the `status` / `isSpeaking` / `onMessage`
events the UI renders. That convenience is exactly what you give up.

### Proposed architecture (self-hosted)

```
  Browser (Next.js, mostly unchanged UI)
     │   mic audio  ▲  transcript + TTS audio
     ▼             │
  Local backend voice service  (new — Python FastAPI or Node, WebSocket)
     ├─ Silero VAD        → detect end-of-turn / barge-in
     ├─ Whisper (STT)     → faster-whisper or whisper.cpp
     ├─ Ollama (LLM)      → Llama 3.1 8B / Qwen2.5 7B, streaming
     └─ Open TTS          → Kokoro (recommended) / Piper / Coqui XTTS
```

### Component choices, rationale & hardware

**STT — Whisper**
- **faster-whisper** (CTranslate2) or **whisper.cpp** (GGML, pure CPU).
- `base.en` / `small.en` run fine on CPU with acceptable latency; `medium`
  / `large-v3` want a GPU for snappy turnaround.
- Chunk by VAD and transcribe each finished utterance (true low-latency
  *streaming partials* are extra work).

**LLM — Ollama**
- Local model via Ollama; exposes an **OpenAI-compatible**
  `/v1/chat/completions` (streaming) and native `/api/chat`.
- Good fits: **Llama 3.1 8B Instruct**, **Qwen2.5 7B Instruct**.
- Hardware: an 8B model at Q4 is ~5 GB on disk, ~6–8 GB RAM to run.
  **A GPU (≈8 GB VRAM) or Apple Silicon is strongly preferred** —
  on pure CPU it generates only a few tokens/sec, which makes
  back-and-forth conversation feel laggy.
- **Quality caveat:** a local 8B model is noticeably weaker than the
  Gemini 2.5 Flash you get through ElevenLabs today — fine for chat,
  less reliable at nuanced slang explanation.

**TTS — open source** (this is what most affects the learning experience)
- **Kokoro** *(recommended)* — 82M params, Apache-licensed, **natural
  American voices**, fast enough on CPU. Best quality-per-watt for our
  goal (real-sounding pronunciation).
- **Piper** — fastest and lightest, runs anywhere on CPU; voices are good
  but a touch robotic. Best for weak hardware / lowest latency.
- **Coqui XTTS v2** — highest quality + voice cloning, but heavy and
  effectively needs a GPU for real-time; project is community-maintained.

### The hard parts (why this isn't a weekend)

1. **Turn-taking / VAD & endpointing** — knowing when the learner has
   finished a sentence (ElevenLabs does this server-side).
2. **Streaming for low latency** — naive *record-fully → STT → wait whole
   LLM → wait whole TTS → play* feels multi-second slow. You need to
   stream the LLM, split it into sentences, TTS each sentence, and stream
   audio out as it's ready.
3. **Barge-in / interruption** — stop speaking the moment the user talks.
4. **Echo cancellation** — keep the mic from hearing GAEY's own voice
   (headphones mostly solve it; browser AEC helps but isn't perfect).
5. **Orchestration state machine** — idle → listening → thinking →
   speaking → (interrupt), emitting the same events the UI expects.
6. **Packaging** — so a non-developer can actually run it (install Ollama,
   pull models, Python env / Docker, download voices).

### What changes in *this* codebase

The good news: **the UI barely changes.** `ConvAI.tsx` only depends on a
small surface — `status`, `isSpeaking`, `startSession`, `endSession`, and
`onMessage({ role, message })`. If we build a **drop-in
`useLocalConversation()` hook with the same shape**, the transcript, speed
slider, waveform, and status indicator all keep working.

| Area | Change |
| --- | --- |
| `components/ConvAI.tsx` UI (transcript, slider, waveform, status) | **Keep** — depends only on a small hook interface |
| `useConversation()` from `@elevenlabs/react` | **Replace** with a custom `useLocalConversation()` (mic capture via AudioWorklet, WS protocol, playback queue, same events) |
| `app/api/signed-url/route.ts` | **Remove** — no signed URL; instead connect to / proxy the local backend WS |
| Backend voice service | **Add** — entirely net-new (VAD + Whisper + Ollama + TTS + streaming orchestration) |
| Env (`AGENT_ID`, `XI_API_KEY`) | **Replace** with backend URL + model/voice config |

The speed control still maps cleanly: pass the slider value as the TTS
engine's speed parameter (Kokoro/Piper both support rate).

### Effort estimate (one competent full-stack dev)

| Scope | What you get | Rough effort |
| --- | --- | --- |
| **Proof of concept** | Push-to-talk, sequential (no barge-in), runs on a dev machine, "it talks back" | **~3–5 days** |
| **Production-ish** | Streaming low-latency, VAD turn-taking, barge-in, packaged for non-devs | **~3–4 weeks** |

Production breakdown (approx dev-days): VAD/endpointing 1–2 · streaming
orchestration + sentence chunking + barge-in 3–5 · robust frontend hook
(AudioWorklet capture, playback queue, events) 3–5 · TTS quality + speed
1–2 · packaging (Docker/Ollama/model bootstrap) 2–3 · echo-cancellation /
errors / reconnect 2–3 · docs & testing 1–2.

### Honest caveats — "free" ≠ zero cost

- **Hardware & electricity:** a smooth local LLM wants a GPU or Apple
  Silicon; on a weak laptop it's slow.
- **Your time:** the build above is the real price.
- **Voice quality:** open TTS is good but, for now, ElevenLabs still sounds
  more natural — and natural pronunciation is the whole point for a
  *learner*.
- **LLM quality:** a local 8B trails Gemini 2.5 Flash.
- **Latency:** the managed pipeline is hard to beat without real effort.

### Middle paths (often the smartest move)

1. **Hybrid:** local Whisper (STT) + local TTS, but a **free-tier cloud
   LLM** (e.g. Google AI Studio's free Gemini, or Groq's free tier).
   Keeps quality up, cost near zero, less local horsepower needed.
2. **Push-to-talk PoC first:** skip VAD/barge-in/streaming to validate the
   idea in days, not weeks; add real-time polish later.
3. **Just manage ElevenLabs credits:** free tier + maybe Starter ($5),
   watch your minutes — by far the least work, best voice quality.

### Recommendation

If the goal is **learning to speak**, voice quality matters most: start on
ElevenLabs (free tier, then Starter/Creator if you talk a lot). Treat the
full self-hosted build as a separate **engineering project** worth doing
when cost at scale, privacy, or offline use becomes the priority — and if
you go that way, start with the **hybrid** option and a **push-to-talk
PoC** before committing to the full real-time rebuild.

---

### Sources (verify live; figures as of June 2026)

- ElevenLabs pricing — https://elevenlabs.io/pricing
- ElevenLabs Agents pricing — https://elevenlabs.io/pricing/agents
- "How much does ElevenLabs Agents cost?" (help center) —
  https://help.elevenlabs.io/hc/en-us/articles/29298065878929-How-much-does-ElevenAgents-cost
- Whisper / faster-whisper — https://github.com/SYSTRAN/faster-whisper ·
  whisper.cpp — https://github.com/ggerganov/whisper.cpp
- Ollama — https://ollama.com
- Kokoro TTS — https://github.com/hexgrad/kokoro · Piper —
  https://github.com/rhasspy/piper · Coqui TTS —
  https://github.com/coqui-ai/TTS
- Silero VAD — https://github.com/snakers4/silero-vad
