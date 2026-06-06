# GAEY

> 中文版见 [`README.md`](./README.md)

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

See [`PLAN.md`](./PLAN.md) for the full roadmap and [`CLAUDE.md`](./CLAUDE.md)
for assistant/developer guidance.

## How it works

This web app contains **no AI model**. It is a thin client for
**ElevenLabs Conversational AI**:

1. The browser asks the local `/api/signed-url` route for a short-lived
   signed URL (built from `AGENT_ID` + `XI_API_KEY`).
2. The client opens a realtime voice session (microphone + audio) to it.
3. **The LLM (e.g. Gemini 2.5 Flash), speech-to-text, and text-to-speech
   all run on ElevenLabs' servers.**

So the AI's **persona, voice, model, and speech speed** are all configured
on the **ElevenLabs dashboard**, not in this code. (Fixing "too much
profanity / too heavy an accent" means editing the prompt and changing the
voice on the dashboard — not editing code.)

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

## Run locally

Copy `.env.example` to `.env` and fill in your own ElevenLabs config:

```
AGENT_ID=        # your ElevenLabs agent id
XI_API_KEY=      # your ElevenLabs API key (server-side only)
```

Then:

```bash
pnpm install
pnpm dev
# open http://localhost:3000
```

(npm / yarn / bun work too.)

## Configure your own GAEY agent

See the illustrated tutorial in the `doc/` directory. The gist: in the
ElevenLabs dashboard, create an agent, paste GAEY's **system prompt** and
**first message** (recommended text in [`PLAN.md`](./PLAN.md) §7), pick a
friendly voice, set a learner-friendly speed, then put the Agent ID and API
Key into `.env`.

## Learn more

- [Conversational AI Tutorial](https://elevenlabs.io/docs/product/introduction)
- [Conversational AI SDK](https://elevenlabs.io/docs/libraries/conversational-ai-sdk-js)
