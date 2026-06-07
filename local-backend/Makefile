# GAEY local voice backend — dev tasks.
# Run from local-backend/ with the venv activated (see README.md).

PORT ?= 8000

.PHONY: setup run test test-live lint fmt fmt-check typecheck check

setup:  ## Install dev + runtime deps (run inside an activated venv)
	pip install -r requirements-dev.txt

run:  ## Start the API with autoreload (Phase 1+)
	uvicorn app.main:app --reload --port $(PORT)

test:  ## Unit/integration tests (mocks; no real models) — Claude's gate
	pytest

test-live:  ## Tests needing real models/services (you run these)
	pytest -m live

lint:  ## Lint with ruff
	ruff check .

fmt:  ## Format with ruff
	ruff format .

fmt-check:  ## Check formatting without writing
	ruff format --check .

typecheck:  ## Static type check with mypy
	mypy app

check:  ## Everything Claude runs before an auto-commit
	ruff check . && ruff format --check . && mypy app && pytest
