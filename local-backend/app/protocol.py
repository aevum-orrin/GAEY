"""WebSocket message schemas (the frontend/backend contract).

The full pydantic models for client/server messages are defined in Phase 1.
See doc/plan-a-selfhosted.md section D for the wire protocol:
  - text frames  = JSON control messages
  - binary frames = audio (PCM s16le; 16 kHz up, 24 kHz down)
"""

from __future__ import annotations
