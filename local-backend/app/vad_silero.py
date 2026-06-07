"""Silero voice-activity detection / endpointing.

Implemented in Phase 5. Consumes 20 ms PCM frames and reports speech start/end
so the pipeline knows when a turn begins and ends.
"""

from __future__ import annotations


class Endpointer:
    """Detect speech_start / speech_end from a stream of 20 ms PCM frames."""

    def __init__(self, *, silence_ms: int) -> None:
        self.silence_ms = silence_ms

    def process_frame(self, frame: bytes) -> str | None:
        """Return 'speech_start', 'speech_end', or None. Implemented in Phase 5."""
        raise NotImplementedError("Phase 5")

    def reset(self) -> None:
        """Clear internal state between turns. Implemented in Phase 5."""
        raise NotImplementedError("Phase 5")
