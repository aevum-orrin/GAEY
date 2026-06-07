# GAEY local voice backend (Plan A)

Self-hosted voice pipeline — **Whisper (STT) + Ollama (LLM) + Kokoro (TTS)** —
that replaces the ElevenLabs managed service for a zero-per-use, private,
offline-capable GAEY. This directory is independent from the Next.js app; when
the frontend feature flag `NEXT_PUBLIC_CONV_PROVIDER` is not `local`, none of
this runs and the app is unaffected.

> Full phased plan, testing, and acceptance steps: **`../doc/plan-a-selfhosted.md`**.

## Status

Built phase by phase. See the status tracker in the plan doc. **Phase 0**
(this scaffold) only sets up tooling — there is no working server yet
(that lands in Phase 1).

## Requirements

- Python **3.11**
- [Ollama](https://ollama.com) + a model: `ollama pull llama3.1:8b`
- A GPU or Apple Silicon is recommended for low latency (CPU works, slower).

Run the host check anytime:

```bash
bash scripts/check-prereqs.sh
```

## Setup

```bash
cd local-backend
python3.11 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
make setup                         # pip install -r requirements-dev.txt
```

## Dev tasks

```bash
make check        # ruff + format check + mypy + pytest  (the pre-commit gate)
make test         # pytest (mocks; no real models)
make test-live    # pytest -m live  (needs real Ollama/Whisper/Kokoro)
make lint         # ruff check
make fmt          # ruff format
make typecheck    # mypy app
make run          # uvicorn (Phase 1+)
```

## Layout

```
app/        # config + (per-phase) protocol, pipeline, stt, llm, tts, vad, main
scripts/    # human-runnable checks/demos
tests/      # pytest (mocks + audio fixtures)
```

Heavy model dependencies (faster-whisper, kokoro, silero-vad, onnxruntime,
sounddevice) are commented out in `requirements.txt` and installed in their
own phases to keep early phases light.
