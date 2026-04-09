from __future__ import annotations

import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
FRONTEND_DIST_DIR = BASE_DIR / "frontend" / "dist"


def default_database_url() -> str:
    override = os.getenv("QUALITYDOC_DB_URL")
    if override:
        return override

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    database_path = (DATA_DIR / "qualitydoc.db").resolve()
    return f"sqlite:///{database_path.as_posix()}"
