from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, JSON, String, Text, create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker


def utcnow() -> datetime:
    return datetime.now(tz=UTC).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class CatalogItem(Base):
    __tablename__ = "catalog_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    area: Mapped[str] = mapped_column(String(128), index=True)
    description_en: Mapped[str] = mapped_column(Text, default="")
    description_sv: Mapped[str] = mapped_column(Text, default="")
    required: Mapped[bool] = mapped_column(Boolean, default=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    default_owner_role: Mapped[str | None] = mapped_column(String(128), nullable=True)
    review_frequency_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tisax_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    documents: Mapped[list["Document"]] = relationship(back_populates="catalog_item")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    catalog_item_id: Mapped[int | None] = mapped_column(ForeignKey("catalog_items.id"), nullable=True, index=True)
    custom_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    owner: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)
    storage_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_review_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_review_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    review_frequency_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    catalog_item: Mapped[CatalogItem | None] = relationship(back_populates="documents")


class LibraryFile(Base):
    __tablename__ = "library_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    relative_path: Mapped[str] = mapped_column(String(512), unique=True, index=True)
    filename: Mapped[str] = mapped_column(String(255), index=True)
    file_extension: Mapped[str] = mapped_column(String(16))
    title_guess: Mapped[str] = mapped_column(String(255))
    document_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    revision: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_modified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    import_status: Mapped[str] = mapped_column(String(32), default="unmapped", index=True)
    is_present: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    catalog_item_id: Mapped[int | None] = mapped_column(ForeignKey("catalog_items.id"), nullable=True, index=True)
    linked_document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    last_scanned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    catalog_item: Mapped[CatalogItem | None] = relationship()
    linked_document: Mapped[Document | None] = relationship()


class Settings(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_name: Mapped[str] = mapped_column(String(128), default="QualityDoc")
    notification_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    due_soon_days: Mapped[int] = mapped_column(Integer, default=30)
    document_root_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    library_last_scanned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


def create_db_engine(database_url: str) -> Engine:
    connect_args: dict[str, Any] = {}
    if database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    return create_engine(database_url, connect_args=connect_args)


def create_session_factory(engine: Engine) -> sessionmaker:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
