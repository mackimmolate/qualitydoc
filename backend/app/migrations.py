from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def run_sqlite_migrations(engine: Engine) -> None:
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    if "settings" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("settings")}
    statements: list[str] = []

    if "document_root_path" not in columns:
        statements.append("ALTER TABLE settings ADD COLUMN document_root_path TEXT")
    if "library_last_scanned_at" not in columns:
        statements.append("ALTER TABLE settings ADD COLUMN library_last_scanned_at DATETIME")

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
