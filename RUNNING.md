# How to run GAEY

A complete, from-scratch guide to running GAEY on your own machine.

> 中英混杂版本见 [`RUNNING.zh-CN.md`](./RUNNING.zh-CN.md).

GAEY is a thin web client for **ElevenLabs Conversational AI**. The app has
no AI model of its own — the brain (LLM), the ears (speech-to-text), and
the voice (text-to-speech) all run on ElevenLabs. So setup is two parts:
**(A)** create your agent on ElevenLabs, and **(B)** run this web app and
point it at that agent.

## Prerequisites

- A normal computer (Windows / macOS / Linux). **No GPU needed.**
- **Node.js 18+** and a package manager (**pnpm** recommended).
- A modern browser (Chrome / Edge / Safari) with a **microphone**, plus
  speakers or headphones.
- An internet connection.
- A **free ElevenLabs account** (https://elevenlabs.io).

## Part A — Create your GAEY agent on ElevenLabs

You do this once, on the ElevenLabs website (it cannot be done from code).
The `doc/` folder has screenshots for each step.

1. **Sign up / log in** at https://elevenlabs.io.
2. Go to the **Agents** platform → **Agents** → **New agent**.
3. In the **Agent** tab, paste GAEY's **system prompt** and **first
   message** from [`doc/agent-prompt.md`](./doc/agent-prompt.md).
4. **Voice:** pick a friendly, young-sounding American voice (Voice Library
   or Voice Design). **Language:** English. **LLM:** Gemini 2.5 Flash is a
   good default.
5. **Speed (optional):** in the **Voice** tab, set a learner-friendly
   default (~0.9–1.0).
6. **Enable the speed override:** in **Security → Overrides**, turn on
   **speed**. This is required for the in-app speed slider to work.
7. Copy your **Agent ID** (shown in the top bar of the agent page).
8. Create an **API key:** go to **Developers → API Keys → Create Key** and
   copy it. (Treat this key like a password.)

## Part B — Run the web app

1. **Get the code** and switch to the working branch:

   ```bash
   git clone <your-fork-url> GAEY
   cd GAEY
   git checkout gaey-test
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Configure environment variables.** Copy the example file and fill in
   the two values from Part A:

   ```bash
   cp .env.example .env
   ```

   ```
   AGENT_ID=your-elevenlabs-agent-id
   XI_API_KEY=your-elevenlabs-api-key
   ```

   `.env` is gitignored — never commit it.

4. **Start the dev server:**

   ```bash
   pnpm dev
   ```

   Open http://localhost:3000.

5. Click **Start conversation**, allow microphone access when the browser
   asks, and start talking. You'll see the transcript fill in for both
   sides, and you can drag the **speech-speed** slider to set GAEY's pace.

## Production build (optional)

```bash
pnpm build
pnpm start
```

## Useful commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Run the dev server at http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint |

## Troubleshooting

- **"Failed to get signed url" / it won't connect.** Check that `AGENT_ID`
  and `XI_API_KEY` are set correctly in `.env`, and restart `pnpm dev`
  after editing `.env`.
- **No microphone / nothing is heard.** Make sure you allowed mic access in
  the browser, and that your OS input/output devices are correct. Browsers
  only allow mic access over `http://localhost` or HTTPS.
- **The speed slider seems to do nothing.** Enable the **speed** override in
  your agent's **Security → Overrides** settings (Part A, step 6). The
  slider applies when you *start* a conversation, not mid-call.
- **It says I'm out of credits.** ElevenLabs voice conversations consume
  credits per minute. The free tier is limited; heavy use needs a paid
  plan.
- **GAEY swears / sounds like a caricature.** That's the persona, which
  lives on the dashboard — not in this code. Update the system prompt
  (see `doc/agent-prompt.md`) and/or change the voice on ElevenLabs.
