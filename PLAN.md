# GAEY — Project Plan & Roadmap

> Living document. Updated as the project evolves.

## 1. Vision

**GAEY** is a friendly, voice-first AI conversation partner that helps
Chinese international students (and anyone learning American English)
understand and start using **authentic, everyday spoken American
English** — current slang, idioms, and casual expressions — by simply
chatting, the way you would with a friend.

The problem it solves: many students have strong "textbook" English but
struggle to follow how Americans actually talk casually (slang, idioms,
filler, references). GAEY is a low-pressure way to hear and practice that.

**Personality target:** a chill, warm, supportive American friend in their
early 20s. Natural conversational accent. Uses real slang but **explains
it** when useful. **PG / minimal profanity**, no caricature of any single
accent or group, not aggressive or insulting — just normal friendly talk.

## 2. Background — built on NEGA

GAEY is **built on NEGA**, the upstream project this repository was forked
from. NEGA is a clean, well-built ElevenLabs
Conversational AI starter, but its agent persona was a heavy "African
American urban street" character with a lot of profanity. GAEY reuses
NEGA's solid technical foundation and rebuilds the persona around a
friendly, modern, teach-me-real-English experience.

(That's the only place we need to call this out — once is enough.)

## 3. How it works (architecture in one paragraph)

This app is a **thin client** for **ElevenLabs Conversational AI**. It
contains no AI model. The browser asks our server route
(`app/api/signed-url`) for a short-lived signed URL (built from
`AGENT_ID` + `XI_API_KEY`), then opens a realtime mic+audio session via the
`@elevenlabs/react` `useConversation()` hook. ElevenLabs runs the LLM
(e.g. Gemini 2.5 Flash), speech-to-text, and the voice (text-to-speech).

**Crucial:** the persona, voice, LLM choice, first message, and speech
speed all live on the **ElevenLabs dashboard**, not in this code. See
`CLAUDE.md` for the full code-vs-dashboard table. Code changes can add
*features* (transcript, controls); they cannot change *who the AI is*.

## 4. Cost, hardware & "do I need a GPU?"

**Short answer: free to run, no GPU, runs on any laptop. The only cost is
ElevenLabs usage.**

### Money

- **The app / code:** 100% free and open source. No payment in the code.
- **ElevenLabs (the real dependency):**
  - Has a **free tier** with a monthly credit allowance (the setup
    screenshots show a free workspace with 10,000 credits).
  - **Conversational AI consumes credits per minute** of conversation
    (LLM + TTS + STT are billed through these credits). So the free tier
    is fine for testing but limited for daily use; heavy use needs a paid
    plan (Starter / Creator / etc.).
  - **Voice creation tiers:** *Voice Design* (text-prompt voice) works on
    the free tier; *Instant Voice Cloning* needs Starter+; *Professional
    Voice Cloning* needs Creator+.
  - The LLM (Gemini 2.5 Flash and friends) is **included via ElevenLabs**
    — you do **not** need a separate OpenAI/Google API key.

### Hardware & software

- **Any normal computer** (Windows / macOS / Linux). No special hardware.
- **No GPU. Ever.** You never run a model on your machine.
- Software: **Node.js 18+**, a package manager (pnpm recommended), a
  **modern browser** (Chrome/Edge/Safari) with a **microphone**, speakers
  or headphones, and an internet connection.

### "If I change the model / persona, do I need a GPU?"

No. "Changing the model" means **picking a different LLM from a dropdown**
in the ElevenLabs agent settings (Gemini, GPT, Claude, …) — it runs on
their servers. "Changing the persona" means **editing prompt text** on the
dashboard. "Changing the voice / speed" means **dashboard settings**. None
of these touch your local compute.

### Deeper dive: free-tier budget & a fully self-hosted alternative

See **`doc/cost-and-self-hosting.md`** for (1) a breakdown of how far the
ElevenLabs free tier goes and what daily practice actually costs, and
(2) a design + effort estimate for a 100% free, self-hosted pipeline
(Whisper + Ollama + open-source TTS), including what would change in this
codebase.

## 5. Workstreams & milestones

### M1 — Rebrand NEGA → GAEY  ✅ (in progress)

- [x] Add `CLAUDE.md` (assistant guidance) and `PLAN.md` (this file).
- [x] Rebrand `README.md` / `README_EN.md` to GAEY; reframe around the
      learning-American-slang goal; one "built on NEGA" mention; swap the
      old street-persona prompt for the new GAEY prompt (§7).
- [x] Update `package.json` name and `app/layout.tsx` `<title>`.
- [x] Replace the NEGA-era `public/avatar.png` with a friendly GAEY avatar
      (speech-bubble smiley; SVG source in `public/avatar.svg`).
- [ ] (later) Review/replace the `public/American.mp3` voice sample and the
      NEGA `favicon.ico` to match GAEY's identity.

### M2 — ElevenLabs agent re-config  (USER action on the dashboard)

Code can't do this; it must be done on elevenlabs.io. Steps:

- [ ] Create/clone an agent named **GAEY**.
- [ ] Paste the new **system prompt** (see §7) and **first message**.
- [ ] Pick a friendlier **voice** (Voice Design / Voice Library) — a
      relatable young-American voice, not a heavy single-accent caricature.
- [ ] Set a learner-friendly **speed** default (e.g. ~0.9–1.0) in the
      Voice tab.
- [ ] Keep / pick an **LLM** (Gemini 2.5 Flash is a fine default).
- [ ] Copy the **Agent ID** and create an **API key**; put them in `.env`.
- [ ] (Optional) Turn on the agent's built-in "Realtime transcript" in the
      Widget settings — though we will also build our own in-app
      transcript (M3).

### M3 — Feature: on-screen conversation transcript  ✅ (done)

**Goal:** show, on the page, both what the user said and what GAEY said —
a running, scrollable transcript. (Before: the code only showed the
agent's *current* line and cleared it when the agent stopped speaking;
user lines were discarded.)

- [x] In `ConvAI.tsx`, accumulate messages into a `{ id; role; text }[]`
      state array from the `onMessage` callback. **Verified** against the
      installed types (`@elevenlabs/types@0.4.0`): the discriminator is
      `role: "user" | "agent"` (`source: "user" | "ai"` is deprecated),
      and `onMessage` fires once per finalized turn (no partial/tentative
      duplicates), so each turn is appended directly.
- [x] Render a chat-style transcript (user vs GAEY bubbles), auto-scroll
      to the latest, with clear empty/disconnected states.
- [x] Remove the leftover debug placeholder text (and dead `drift`
      keyframes); add a header with brand + live status.
- [x] Keep the transcript visible after the call ends (reset only when a
      new session starts) so the learner can review.
- [ ] (Nice-to-have) "Clear" / copy-to-clipboard buttons.
- [ ] (Stretch) One-tap "explain this slang" / save-phrase for review.

> Note: full end-to-end behavior (live bubbles appearing as both sides
> speak) needs a real ElevenLabs agent + mic to verify; lint, type-check,
> production build, and SSR render of the new UI all pass.

### M4 — Feature: speech-rate control  ✅ (done)

**Goal:** let the learner slow GAEY down or speed it up.

Resolved during implementation: the installed SDK **does** support a
runtime TTS speed override. Verified in the types
(`@elevenlabs/client@0.13.1`, `BaseSessionConfig.overrides`):
`tts?: { voiceId?; speed?; stability?; similarityBoost? }`. So no
playback-rate hack or preset-reconnect fallback was needed.

- [x] In-app **speech-speed slider** (`0.7×–1.2×`, default `1.0×`) in
      `ConvAI.tsx`, with turtle/rabbit cues, a live readout, placed above
      the call button.
- [x] Applied per session by passing `overrides: { tts: { speed } }` to
      `startSession`; takes effect each time a conversation starts.
- [ ] **Requires** enabling the "speed" override in the agent's ElevenLabs
      **Security → Overrides** settings, otherwise it is ignored. (User
      action on the dashboard; documented in README/RUNNING.)
- [ ] (Nice-to-have) Persist the chosen speed in `localStorage`; optionally
      offer a one-tap restart to apply a new speed mid-conversation.

> Note: end-to-end effect (GAEY actually talking slower/faster) needs a
> real agent with the override enabled to confirm; lint, type-check,
> production build, and SSR render of the control all pass.

### M5 — UI/UX polish  (planned — not started)

Thoughts on what's worth polishing, roughly highest-value first. (The
avatar and English-only copy already landed.)

- [x] Friendlier GAEY avatar (speech-bubble smiley on the brand gradient).
- [x] English-only, GAEY-branded on-screen copy.
- [ ] **Speed slider styling.** The native range input is plain — style the
      track/thumb, show a filled portion, and add subtle "Slow / Normal /
      Fast" hints (or snap presets) so the control feels intentional.
- [ ] **Transcript feel.** Gentle fade/slide-in for new bubbles
      (framer-motion is already a dep), smoother auto-scroll, a "jump to
      latest" affordance when scrolled up, and a nicer empty state.
- [ ] **Live-state cues.** Make connecting / listening / speaking visually
      distinct — e.g. animate the avatar ring while GAEY speaks, tie the
      waveform color to state.
- [ ] **Mobile pass.** Verify the avatar + waveform + transcript + controls
      stack well on small screens; give the transcript more room, compact
      the footer.
- [ ] **Onboarding nudge.** A one-line first-run hint ("Click start and
      just talk — try 'what does _____ mean?'") and maybe a rotating
      slang-of-the-day.
- [ ] **Branding loose ends.** Replace the NEGA `favicon.ico`; review the
      `public/American.mp3` voice sample; small footer/credits.
- [ ] **Theme + a11y.** Check light/dark both look good (next-themes is
      present); add focus states and `prefers-reduced-motion` handling.

### M6 — Docs & tutorial refresh

- [ ] Update `doc/` tutorial (screenshots/steps) for the GAEY agent setup,
      including where to set the system prompt, voice, and speed.

### M7 — Test & ship

- [ ] `pnpm lint` + `pnpm build` clean.
- [ ] Manual test: mic permission, start/stop, transcript, speed control.
- [ ] When ready, open a PR from the working branch into `main`.

## 6. Open questions / decisions

- **Voice choice:** which ElevenLabs voice best fits "relatable young
  American friend" without leaning on one heavy accent? (User to pick on
  the dashboard.)
- **Speed control mechanism:** confirm what the installed SDK actually
  supports for runtime speed (decides M4's exact approach).
- **Transcript persistence:** in-memory only, or save locally
  (localStorage) so learners can review past chats?
- **Assets:** keep or replace `avatar.png` / `American.mp3`.

## 7. Recommended GAEY agent configuration (paste into ElevenLabs)

**System prompt (draft):**

> You are GAEY, a friendly and upbeat American friend who helps Chinese
> international students understand and use authentic, everyday American
> English. Talk like a chill, supportive friend in your early twenties:
> natural conversational American accent, warm and encouraging, with clear
> enunciation. Use common, current American slang, idioms, and casual
> expressions (for example: "what's up", "my bad", "no cap", "lowkey",
> "it's giving…", "hang out", "that's fire", "for real"), and when it's
> helpful, briefly explain what an expression means and when to use it.
> Keep it PG: no profanity or slurs. Light, playful humor is welcome.
> Don't overdo any single regional or ethnic accent or caricature — just
> sound like a relatable, modern American friend. Gently correct mistakes,
> encourage the learner, and keep replies short and conversational so it
> feels like a real chat. Speak at a clear, easy-to-follow pace.

**First message (draft):**

> Yo, what's up! I'm GAEY — think of me as your American buddy. We can just
> hang and chat, and I'll put you on to how people actually talk over here.
> So… what's on your mind?

**Other settings:** Language = English · LLM = Gemini 2.5 Flash (default) ·
Voice = a friendly young-American voice · Speed ≈ 0.9–1.0 to start.
