# GAEY

**GAEY** is a voice conversation AI that helps Chinese international
students — and anyone learning American English — understand and start
using **authentic, everyday American English**: current slang, idioms, and
casual expressions. The method is simple: just talk to it like you would
talk to a friend.

Lots of students have strong "textbook" English but still get lost when
Americans talk casually — the slang, the references, the filler. GAEY is a
low-pressure, friend-like partner to practice with: warm in tone, speaks
real spoken English, **without lots of profanity, without caricaturing any
one accent, and without being aggressive** — just the way friends actually
talk.

> GAEY is built on **NEGA** (this repository was forked from the NEGA
> project). NEGA is a solid ElevenLabs Conversational AI starter; GAEY
> keeps its clean technical foundation and swaps the persona for a
> friendly "teach-me-real-American-English" experience.

**Docs:** [How to run GAEY](./RUNNING.md) · [中英混杂运行指南](./RUNNING.zh-CN.md) ·
[Roadmap (`PLAN.md`)](./PLAN.md) · [Recommended GAEY agent prompt](./doc/agent-prompt.md)

## Features

- 🎙️ **Real-time voice conversation** with a friendly American "buddy".
- 💬 **On-screen transcript** — every line you and GAEY say, shown live so
  you can read along and catch the slang.
- 🐢🐇 **Speech-speed control** — a slider (0.7×–1.2×) to slow GAEY down or
  speed it up to a pace you can follow.

## How it works

This web app contains **no AI model**. It is a thin client for
**ElevenLabs Conversational AI**:

1. The browser asks the local `/api/signed-url` route for a short-lived
   signed URL (built from `AGENT_ID` + `XI_API_KEY`).
2. The client opens a realtime voice session (microphone + audio) to it.
3. **The LLM (e.g. Gemini 2.5 Flash), speech-to-text, and text-to-speech
   all run on ElevenLabs' servers.**

So the AI's **persona, voice, model, and default speech speed** are all
configured on the **ElevenLabs dashboard**, not in this code. (Fixing "too
much profanity / too heavy an accent" means editing the prompt and changing
the voice on the dashboard — not editing code.)

## Cost & hardware

- **Running this app is free** and open source — no paywall in the code.
- The only cost is **ElevenLabs**: there is a **free tier** (the setup
  screenshots show a free workspace with 10,000 credits), but voice
  conversations **consume credits per minute**, so heavy use needs a paid
  plan.
- **No GPU required, ever.** You never run a model locally — the model,
  speech-to-text, and text-to-speech all run on ElevenLabs' servers.
- You only need: a normal computer, Node.js 18+, a package manager, a
  modern browser with a **microphone**, and an internet connection.
- "Do I need a GPU to change the model / persona?" No. Changing the model
  is a **dropdown** on the dashboard; changing the persona is **editing
  prompt text**; changing voice/speed is a **dashboard setting**. None of
  it uses local compute.

## Quick start

```bash
pnpm install
cp .env.example .env   # then fill in AGENT_ID and XI_API_KEY
pnpm dev               # open http://localhost:3000
```

You need your own ElevenLabs agent (Agent ID + API key) in `.env` first.
See **[RUNNING.md](./RUNNING.md)** for the full step-by-step setup.

## Learn more

- [Conversational AI Tutorial](https://elevenlabs.io/docs/product/introduction)
- [Conversational AI SDK](https://elevenlabs.io/docs/libraries/conversational-ai-sdk-js)
