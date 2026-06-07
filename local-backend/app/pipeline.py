"""Conversation orchestration state machine.

The full STT -> LLM -> TTS pipeline is implemented in Phase 6 (push-to-talk)
and made streaming/real-time in Phases 8-10. This module defines the shared
`State` enum now so other modules and tests can reference it early.
"""

from __future__ import annotations

from enum import StrEnum


class State(StrEnum):
    """High-level pipeline state; drives the `state` protocol message."""

    IDLE = "idle"
    LISTENING = "listening"
    THINKING = "thinking"
    SPEAKING = "speaking"
