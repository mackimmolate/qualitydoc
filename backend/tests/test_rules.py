from __future__ import annotations

from datetime import date

from app.db import CatalogItem, Document
from app.rules import build_dashboard, clean_tags, derive_next_review, document_flags, serialize_catalog_item


def test_clean_tags_deduplicates_and_trims() -> None:
    assert clean_tags([" Policy ", "policy", "", "owner"]) == ["Policy", "owner"]


def test_derive_next_review_uses_calendar_months() -> None:
    assert derive_next_review(date(2026, 1, 31), 1) == date(2026, 2, 28)


def test_document_flags_for_owner_due_soon_and_overdue() -> None:
    document = Document(status="active", owner=None, next_review_date=date(2026, 4, 20), tags=[])
    flags = document_flags(document, due_soon_days=30, today=date(2026, 4, 9))
    assert flags == {"needs_owner": True, "overdue": False, "due_soon": True}

    document.next_review_date = date(2026, 4, 1)
    flags = document_flags(document, due_soon_days=30, today=date(2026, 4, 9))
    assert flags["overdue"] is True


def test_archived_documents_do_not_cover_active_alerts() -> None:
    item = CatalogItem(
        id=1,
        code="GOV-001",
        title="Information Security Policy",
        area="Governance",
        description_en="",
        description_sv="",
        required=True,
        active=True,
        default_owner_role="Security lead",
        review_frequency_months=12,
        tisax_tags=[],
    )
    archived_document = Document(id=2, catalog_item_id=1, status="archived", owner="Owner", tags=[])
    payload = serialize_catalog_item(item, [archived_document], due_soon_days=30, today=date(2026, 4, 9))
    assert payload["missing"] is True


def test_dashboard_uses_override_review_cadence() -> None:
    item = CatalogItem(
        id=1,
        code="OPS-002",
        title="Backup and Restore Procedure",
        area="Operations",
        description_en="",
        description_sv="",
        required=True,
        active=True,
        default_owner_role="IT operations",
        review_frequency_months=12,
        tisax_tags=[],
    )
    document = Document(
        id=10,
        catalog_item_id=1,
        catalog_item=item,
        status="active",
        owner="Infra",
        last_review_date=date(2026, 4, 1),
        next_review_date=date(2026, 5, 1),
        review_frequency_months=1,
        tags=[],
    )

    dashboard = build_dashboard([item], [document], due_soon_days=30, today=date(2026, 4, 9))
    assert dashboard["summary"]["coverage_percent"] == 100
    assert dashboard["summary"]["due_soon"] == 1
