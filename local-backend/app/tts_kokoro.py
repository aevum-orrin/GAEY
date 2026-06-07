"""Kokoro text-to-speech wrapper.

Implemented in Phase 3. Synthesizes natural American-English speech and emits
24 kHz mono PCM-16 (see doc/plan-a-selfhosted.md section C).
"""

from __future__ import annotations


def synthesize(text: str, *, voice: str, speed: float = 1.0) -> bytes:
    """Synthesize `text` to 24 kHz mono PCM-16 bytes. Implemented in Phase 3."""
    raise NotImplementedError("Phase 3")
