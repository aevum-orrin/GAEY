# Local Deployment Guide — NEGA

> **Audience.** This document is the setup brief for getting NEGA running on a
> local developer machine. It is written to be actionable by an automated coding
> assistant (Claude Code) *and* readable by a human developer. Read this file and
> `README.md` before changing anything.

## 1. What NEGA is

NEGA is a voice conversational-AI web app. Stack:

- **Next.js 15** (App Router) + **React 19**
- **TypeScript** + **Tailwind CSS**
- **ElevenLabs Conversational AI** (`@elevenlabs/react`) for the real-time voice agent

Runtime flow: the browser requests microphone permission, calls the server route
`app/api/signed-url/route.ts` to obtain a short-lived signed URL from ElevenLabs,
then opens a live voice session with a configured ElevenLabs agent.

## 2. Important: this is a Node.js project, NOT Python

There is **no Python and no `venv`** anywhere in this repository. For a Node app,
"environment isolation" is achieved by:

- a project-local `node_modules/` (already per-project, never installed globally), and
- pinning the Node.js version (see `.nvmrc` and step 3).

Do **not** create a Python virtual environment — it does not apply here. The
package manager is **pnpm** (a `pnpm-lock.yaml` is committed).

## 3. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 LTS (>= 18.18) | Use `nvm`; honor `.nvmrc` if present |
| pnpm | latest | `corepack enable` then `corepack prepare pnpm@latest --activate` |
| Git | any recent | |
| Browser | Chrome / Edge / Firefox | must be allowed to use the microphone |
| Microphone | — | required for the voice session |
| ElevenLabs account | — | provides `AGENT_ID` + `XI_API_KEY` (manual, see step 5) |

## 4. Install dependencies

```bash
# from the repo root, on the main branch
node -v             # confirm v20.x
corepack enable
pnpm install        # installs from pnpm-lock.yaml
```

## 5. Configure credentials (manual — cannot be automated)

NEGA needs an ElevenLabs Conversational AI agent. These two secrets are the
only thing standing between a clean checkout and a running app.

1. Sign in at <https://elevenlabs.io> → **Conversational AI** → create an agent.
   - The voice/persona prompt is in `README.md`.
   - `public/American.mp3` is a reference voice sample for that persona.
2. Copy the **Agent ID** (looks like `agent_xxxxxxxx`).
3. Open your **Profile** → copy your **API key** (looks like `sk_xxxxxxxx`).
4. Create a `.env` file in the repo root (copy the shape of `.env.example`):

   ```bash
   AGENT_ID=agent_xxxxxxxx
   XI_API_KEY=sk_xxxxxxxx
   ```

`.env` is git-ignored and must **never** be committed.

## 6. Run

```bash
pnpm dev            # serves http://localhost:3000
```

Open the URL → click **"Start conversation"** → allow the microphone. The avatar
ring turns green and the waveform animates once the agent connects.

## 7. Verify (there is no automated test suite)

```bash
pnpm lint
pnpm build          # a successful production build is the primary success gate
pnpm start          # serves the production build on :3000
```

Success criteria that can be checked **without** credentials: lint passes, the
production build completes, and the dev server renders the page (avatar, the
"Disconnected" state, and the "Start conversation" button). The actual voice
round-trip can only be confirmed manually with a real microphone and real keys.

## 8. Setup checklist for the coding assistant

**Do (additive, low-risk):**

- [ ] Add a `.nvmrc` pinning Node 20 (new file).
- [ ] Verify `.gitignore` ignores `node_modules/`, `.next/`, and `.env*` (it
      already does — confirm, extend only if a gap is found).
- [ ] Scaffold a local `.env` from `.env.example` with **empty** values
      (git-ignored; never fill in real secrets).
- [ ] Keep `README.md` and the deployment docs in sync with any change you make.
- [ ] Run `pnpm lint` and `pnpm build` to prove the app still compiles.

**Avoid:**

- Modifying existing application source under `app/`, `components/`, or `lib/`
  unless a change is strictly required to build/run.
- Committing secrets, `node_modules/`, or build output (`.next/`).
- Git-ignoring **required** assets: `public/avatar.png` is rendered by the UI and
  `public/American.mp3` is the reference voice — keep both tracked.

## 9. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `/api/signed-url` returns 500, "AGENT_ID is not set" | `.env` missing or not loaded — create it, then restart `pnpm dev` |
| "Failed to get signed url" toast | wrong/expired `XI_API_KEY`, or the agent is not enabled for signed URLs |
| No audio / mic prompt never appears | the browser blocked the microphone, or the page is not served over `localhost`/https |
| Engine or build errors | wrong Node version — run `nvm use` to match `.nvmrc` |

## 10. Conventions for this repo

- Code and code comments: **English only** (keep comments concise).
- Commit after each meaningful edit; **do not push** unless explicitly asked.
- Commit attribution: author **aevum-orrin**, with a `Co-Authored-By: Claude`
  trailer, so both appear as contributors.
