# CLAUDE.md

Guidance for Claude (and other AI assistants) working in this repository.

## What GAEY is

**GAEY** is a voice-based conversational AI web app that helps Chinese
international students learn **authentic, everyday American English** —
current slang, idioms, and casual expressions — by just talking to a
friendly American "buddy". The goal is natural, friendly conversation
(the way friends actually talk), **not** profanity-heavy or caricatured
speech.

GAEY is **built on NEGA** (the upstream project this repo was forked
from). NEGA was an English-grammar agent with a heavy "African American
urban street" persona and frequent profanity. GAEY keeps NEGA's clean
technical foundation but replaces the persona with a friendly, PG,
modern-American-friend personality focused on teaching real spoken
English.

## Architecture (read this before changing anything)

This is a **thin client** for **ElevenLabs Conversational AI**. The app
itself contains **no AI model**. All the "intelligence" lives on the
ElevenLabs platform.

Request flow:

1. Browser loads the Next.js app (`app/page.tsx` → `components/ConvAI.tsx`).
2. User clicks "Start conversation". The client calls the server route
   `app/api/signed-url/route.ts`.
3. That route uses `AGENT_ID` + `XI_API_KEY` (server-side env vars) to ask
   ElevenLabs for a short-lived **signed URL**.
4. The client opens a realtime voice session to that signed URL via the
   `@elevenlabs/react` `useConversation()` hook (WebSocket/WebRTC + mic).
5. ElevenLabs runs the **LLM** (e.g. Gemini 2.5 Flash), **speech-to-text**,
   and **text-to-speech (the voice)**. Audio streams back and plays.

### What lives in CODE vs. on the ELEVENLABS DASHBOARD

This split is the single most important thing to understand.

| Concern | Where it lives | How to change |
| --- | --- | --- |
| Agent **persona / system prompt** | ElevenLabs dashboard (Agent tab) | Edit prompt text on the site |
| **First message** | ElevenLabs dashboard (Agent tab) | Edit on the site |
| **LLM model** (Gemini/GPT/Claude…) | ElevenLabs dashboard (Agent tab) | Pick from a dropdown |
| **Voice** (timbre/accent) | ElevenLabs dashboard (Voices) | Design/select a voice |
| **Speech speed** (0.7–1.2) | ElevenLabs dashboard (Voice tab) | Slider, default 1.0 |
| Connection / signed URL | `app/api/signed-url/route.ts` | Code |
| UI, on-screen transcript, controls | `components/ConvAI.tsx` etc. | Code |
| Which agent we connect to | `AGENT_ID` env var | `.env` |

> Fixing "too much profanity / too much of one accent" is **not a code
> change** — it is done by rewriting the system prompt and choosing a
> different voice on the ElevenLabs dashboard. The code can only surface
> features (like an on-screen transcript or a speed control); it cannot
> change the personality.

## Key files

- `app/page.tsx` — page shell, renders `<ConvAI/>`.
- `app/layout.tsx` — root layout + `<title>` metadata.
- `components/ConvAI.tsx` — **the core component**: start/stop session,
  mic permission, status, and message handling (`onMessage`). This is
  where the on-screen transcript and speed control will be built.
- `app/api/signed-url/route.ts` — server route that mints the ElevenLabs
  signed URL from env vars.
- `components/ui/live-waveform.tsx` — canvas mic-input waveform animation.
- `components/background-aura.tsx` — decorative animated background.
- `components/ui/*` — shadcn/ui primitives (button, card, sonner toaster).
- `public/avatar.png`, `public/American.mp3` — agent avatar + a voice
  sample (NEGA-era assets; review/replace to match GAEY's identity).
- `doc/*.png` — step-by-step ElevenLabs setup tutorial (screenshots).

## Tech stack

Next.js 15 (App Router, Turbopack) · React 19 (RC) · TypeScript (strict) ·
Tailwind CSS 3 + shadcn/ui (new-york style) · `@elevenlabs/react` +
`@11labs/client` · framer-motion/motion · sonner (toasts). Package manager:
**pnpm** (see `pnpm-lock.yaml`).

## Common commands

```bash
pnpm install      # install deps
pnpm dev          # run dev server (http://localhost:3000)
pnpm build        # production build
pnpm start        # serve the production build
pnpm lint         # next lint (eslint)
```

Environment variables (copy `.env.example` to `.env`, never commit `.env`):

```
AGENT_ID=        # ElevenLabs Conversational AI agent id
XI_API_KEY=      # ElevenLabs API key (server-side only)
```

## Cost & hardware (FAQ)

- **Running this app is free** and open source. There is no paywall in
  the code.
- The **paid dependency is ElevenLabs**. A free tier exists (limited
  monthly credits); voice conversations consume credits per minute, so
  heavy use needs a paid plan.
- **No GPU is required, ever.** You never run a model locally. The LLM,
  STT, and TTS all run on ElevenLabs' (and Google's) servers.
- Requirements: any normal computer, Node.js 18+, a package manager, a
  modern browser with a **microphone**, and an internet connection.

See `PLAN.md` for the full roadmap, the recommended GAEY system prompt,
and a detailed cost breakdown.

## Conventions

- **All code and code comments are in English** unless explicitly told
  otherwise.
- Match the surrounding code style (the repo mixes 2-space and 4-space
  files; follow whichever file you are editing).
- Keep changes focused; prefer small, reviewable commits.

## Git workflow for this fork

- This repo is a fork. Day-to-day development happens on a feature branch
  and is later PR'd into `main`. The user's working branch is
  **`gaey-test`**.
- **Commit after every code change** with a clear message.
- **Only push when the user explicitly asks**, and push to the branch the
  user names (default `gaey-test`). Do not open a PR unless asked.
- **Commit attribution** must show **both** the user and Claude, keep
  commits **Verified** on GitHub, and **never** expose the user's real
  `@umich.edu` email. Use a split author/committer identity:
  - **Author** = `aevum-orrin <272573266+aevum-orrin@users.noreply.github.com>`
    — so the user shows as a contributor. Pass it explicitly on every
    commit: `git commit --author="aevum-orrin <272573266+aevum-orrin@users.noreply.github.com>"`.
  - **Committer** = `Claude <noreply@anthropic.com>` — so the commit is
    Verified. Set via `git config user.name Claude` /
    `git config user.email noreply@anthropic.com`.
  - **Trailer** = `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Mention "Built on NEGA" sparingly — once is enough in user-facing docs.
