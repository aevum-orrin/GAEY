"""FastAPI application entrypoint.

Phase 1 implements:
  - GET /health  -> {"status": "ok", "version": ...}
  - WS  /ws      -> protocol handshake (ready / ping-pong / start / end)

This Phase-0 placeholder keeps the package importable for the scaffold tests
without pulling in the web framework wiring yet. The FastAPI `app` instance
and routes are added in Phase 1.
"""

from __future__ import annotations
