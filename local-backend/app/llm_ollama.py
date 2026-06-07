"""Ollama streaming chat client.

Implemented in Phase 2. Talks to a local Ollama daemon over HTTP and streams
assistant tokens back for low-latency speech synthesis.
"""

from __future__ import annotations

from collections.abc import AsyncIterator


async def stream_chat(messages: list[dict[str, str]], *, model: str) -> AsyncIterator[str]:
    """Yield assistant tokens from Ollama for the given chat `messages`.

    Implemented in Phase 2.
    """
    raise NotImplementedError("Phase 2")
    yield ""  # unreachable; marks this as an async generator for typing
