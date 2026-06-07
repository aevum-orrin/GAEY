#!/usr/bin/env bash
# Check the host has what Plan A needs: Ollama (+ model), Python 3.11, audio
# tooling, and available acceleration. Prints a status line per item with a fix
# hint. Always exits 0 — this is informational, not a gate.
set -u

ok()   { printf '  [\033[32mOK\033[0m]   %s\n' "$1"; }
warn() { printf '  [\033[33mWARN\033[0m] %s\n' "$1"; }
bad()  { printf '  [\033[31mFAIL\033[0m] %s\n' "$1"; }
info() { printf '  [\033[34mINFO\033[0m] %s\n' "$1"; }

echo "GAEY Plan A - prerequisite check"
echo

# --- Python 3.11 ---
if command -v python3.11 >/dev/null 2>&1; then
  ok "python3.11 found ($(python3.11 --version 2>&1))"
else
  bad "python3.11 not found - install Python 3.11 (brew install python@3.11 / apt / winget)"
fi

# --- Ollama ---
if command -v ollama >/dev/null 2>&1; then
  ok "ollama found ($(ollama --version 2>&1 | head -n1))"
  host="${OLLAMA_HOST:-http://localhost:11434}"
  if curl -fsS "${host}/api/tags" >/dev/null 2>&1; then
    ok "ollama daemon reachable at ${host}"
    model="${LLM_MODEL:-llama3.1:8b}"
    if ollama list 2>/dev/null | grep -q "${model%%:*}"; then
      ok "model present: ${model}"
    else
      warn "model '${model}' not pulled yet - run: ollama pull ${model}"
    fi
  else
    warn "ollama daemon not reachable at ${host} - start it: ollama serve"
  fi
else
  bad "ollama not found - install from https://ollama.com (then: ollama pull llama3.1:8b)"
fi

# --- Acceleration (informational) ---
if command -v nvidia-smi >/dev/null 2>&1; then
  gpu="$(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null | head -n1)"
  ok "NVIDIA GPU: ${gpu:-detected}"
elif [ "$(uname -s)" = "Darwin" ] && [ "$(uname -m)" = "arm64" ]; then
  info "Apple Silicon detected - good acceleration via Metal"
else
  warn "no NVIDIA GPU detected - CPU-only works but expect higher latency"
fi

# --- Audio playback tooling (for demo scripts; optional) ---
if command -v ffplay >/dev/null 2>&1 || command -v aplay >/dev/null 2>&1 \
   || command -v afplay >/dev/null 2>&1; then
  ok "audio playback tool available"
else
  info "no aplay/afplay/ffplay found - needed only to play demo WAVs"
fi

echo
echo "Done. WARN/FAIL items are advisory; see doc/plan-a-selfhosted.md Phase 0."
exit 0
