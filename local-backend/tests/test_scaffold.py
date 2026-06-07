"""Phase 0 scaffold tests: the package imports cleanly and settings load."""

from __future__ import annotations

from app import __version__
from app.config import Settings, get_settings
from app.pipeline import State


def test_version_is_set() -> None:
    assert isinstance(__version__, str)
    assert __version__


def test_settings_defaults() -> None:
    settings = Settings()
    assert settings.ollama_host.startswith("http")
    assert settings.llm_model
    assert settings.tts_sample_rate == 24000
    assert settings.input_sample_rate == 16000
    assert "http://localhost:3000" in settings.allow_origins_list


def test_get_settings_returns_settings() -> None:
    assert isinstance(get_settings(), Settings)


def test_pipeline_states() -> None:
    assert State.IDLE.value == "idle"
    assert {state.value for state in State} == {
        "idle",
        "listening",
        "thinking",
        "speaking",
    }
