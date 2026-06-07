"""Application settings, loaded from environment variables / a local .env.

All defaults match doc/plan-a-selfhosted.md (sections C and E). Override any
value via the process environment or local-backend/.env.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Backend configuration. See local-backend/.env.example for the keys."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Ollama (LLM runtime)
    ollama_host: str = "http://localhost:11434"
    llm_model: str = "llama3.1:8b"

    # Whisper (STT)
    whisper_model: str = "base.en"
    whisper_device: str = "auto"  # cpu | cuda | auto

    # Kokoro (TTS)
    kokoro_voice: str = "af_heart"
    tts_sample_rate: int = 24000

    # VAD / endpointing
    vad_silence_ms: int = 700

    # Audio conventions (see doc/plan-a-selfhosted.md section C)
    input_sample_rate: int = 16000

    # CORS: comma-separated list of allowed browser origins
    allow_origins: str = "http://localhost:3000"

    @property
    def allow_origins_list(self) -> list[str]:
        """Parse `allow_origins` into a clean list for the CORS middleware."""
        return [origin.strip() for origin in self.allow_origins.split(",") if origin.strip()]


def get_settings() -> Settings:
    """Return a fresh Settings instance (env is re-read each call)."""
    return Settings()
