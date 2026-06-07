"""Shared pytest fixtures.

Model mocks (Ollama via respx, Whisper, Kokoro, VAD) are added in their
respective phases; see doc/plan-a-selfhosted.md section F.1. Phase 0 keeps
this minimal.
"""

from __future__ import annotations
