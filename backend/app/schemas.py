from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


DocumentStatus = Literal["draft", "active", "review", "archived"]


class CatalogItemRead(BaseModel):
    id: int
    code: str
    title: str
    area: str
    description_en: str
    description_sv: str
    required: bool
    active: bool
    default_owner_role: str | None
    review_frequency_months: int | None
    tisax_tags: list[str]
    coverage_count: int
    missing: bool
    needs_owner_count: int
    due_soon_count: int
    overdue_count: int


class CatalogItemUpdate(BaseModel):
    required: bool | None = None
    active: bool | None = None
    default_owner_role: str | None = None
    review_frequency_months: int | None = Field(default=None, ge=1, le=36)
    description_en: str | None = None
    description_sv: str | None = None


class DocumentWrite(BaseModel):
    catalog_item_id: int | None = None
    custom_title: str | None = None
    owner: str | None = None
    status: DocumentStatus = "active"
    storage_link: str | None = None
    last_review_date: date | None = None
    next_review_date: date | None = None
    review_frequency_months: int | None = Field(default=None, ge=1, le=36)
    notes: str | None = None
    tags: list[str] = Field(default_factory=list)


class DocumentUpdate(BaseModel):
    catalog_item_id: int | None = None
    custom_title: str | None = None
    owner: str | None = None
    status: DocumentStatus | None = None
    storage_link: str | None = None
    last_review_date: date | None = None
    next_review_date: date | None = None
    review_frequency_months: int | None = Field(default=None, ge=1, le=36)
    notes: str | None = None
    tags: list[str] | None = None


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    catalog_item_id: int | None
    catalog_code: str | None
    catalog_title: str | None
    area: str
    title: str
    custom_title: str | None
    owner: str | None
    status: DocumentStatus
    storage_link: str | None
    last_review_date: date | None
    next_review_date: date | None
    review_frequency_months: int | None
    effective_review_frequency_months: int | None
    recommended_owner_role: str | None
    notes: str | None
    tags: list[str]
    needs_owner: bool
    due_soon: bool
    overdue: bool
    archived: bool
    updated_at: datetime


class DashboardSummary(BaseModel):
    total_documents: int
    active_documents: int
    coverage_percent: int
    missing_required: int
    needs_owner: int
    due_soon: int
    overdue: int


class DashboardAlert(BaseModel):
    kind: str
    severity: str
    title: str
    detail: str


class DashboardRead(BaseModel):
    summary: DashboardSummary
    alerts: list[DashboardAlert]
    upcoming_reviews: list[DocumentRead]


class SettingsRead(BaseModel):
    workspace_name: str
    notification_enabled: bool
    due_soon_days: int
    document_root_path: str | None
    library_last_scanned_at: datetime | None


class SettingsUpdate(BaseModel):
    workspace_name: str | None = None
    notification_enabled: bool | None = None
    due_soon_days: int | None = Field(default=None, ge=1, le=180)
    document_root_path: str | None = None


class LibraryFileRead(BaseModel):
    id: int
    relative_path: str
    absolute_path: str | None
    filename: str
    file_extension: str
    title_guess: str
    document_date: date | None
    revision: int | None
    file_modified_at: datetime | None
    file_size_bytes: int | None
    import_status: str
    is_present: bool
    catalog_item_id: int | None
    catalog_code: str | None
    catalog_title: str | None
    catalog_area: str | None
    suggested_catalog_item_id: int | None
    suggested_catalog_code: str | None
    suggested_catalog_title: str | None
    suggested_catalog_area: str | None
    suggestion_score: int
    effective_catalog_area: str | None
    linked_document_id: int | None
    linked_document_title: str | None
    last_scanned_at: datetime | None


class LibraryFileUpdate(BaseModel):
    import_status: str | None = None
    catalog_item_id: int | None = None


class LibraryScanRead(BaseModel):
    root_path: str
    scanned_at: datetime
    scanned_count: int
    discovered_count: int
    updated_count: int
    missing_count: int


class OpenLinkResponse(BaseModel):
    ok: bool
    message: str
