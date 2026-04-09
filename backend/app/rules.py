from __future__ import annotations

from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Iterable

from .db import CatalogItem, Document


DOCUMENT_STATUSES = {"draft", "active", "review", "archived"}


def add_months(base_date: date, months: int) -> date:
    if months < 1:
        return base_date

    year = base_date.year + (base_date.month - 1 + months) // 12
    month = (base_date.month - 1 + months) % 12 + 1
    day = min(base_date.day, monthrange(year, month)[1])
    return date(year, month, day)


def clean_tags(tags: Iterable[str] | None) -> list[str]:
    if not tags:
        return []

    deduped: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        value = tag.strip()
        if not value:
            continue
        lowered = value.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        deduped.append(value)
    return deduped


def effective_review_months(document: Document) -> int | None:
    if document.review_frequency_months:
        return document.review_frequency_months
    if document.catalog_item and document.catalog_item.review_frequency_months:
        return document.catalog_item.review_frequency_months
    return None


def derive_next_review(last_review_date: date | None, review_months: int | None) -> date | None:
    if not last_review_date or not review_months:
        return None
    return add_months(last_review_date, review_months)


def is_archived(document: Document) -> bool:
    return document.status == "archived"


def document_flags(document: Document, due_soon_days: int, today: date) -> dict[str, bool]:
    archived = is_archived(document)
    next_review = document.next_review_date
    overdue = bool(not archived and next_review and next_review < today)
    due_soon = bool(
        not archived
        and next_review
        and today <= next_review <= today + timedelta(days=due_soon_days)
        and not overdue
    )
    return {
        "needs_owner": bool(not archived and not (document.owner or "").strip()),
        "overdue": overdue,
        "due_soon": due_soon,
    }


def document_title(document: Document) -> str:
    if document.custom_title and document.custom_title.strip():
        return document.custom_title.strip()
    if document.catalog_item:
        return document.catalog_item.title
    return "Untitled document"


def serialize_document(document: Document, due_soon_days: int, today: date) -> dict[str, Any]:
    flags = document_flags(document, due_soon_days, today)
    catalog_item = document.catalog_item
    review_months = effective_review_months(document)

    return {
        "id": document.id,
        "catalog_item_id": document.catalog_item_id,
        "catalog_code": catalog_item.code if catalog_item else None,
        "catalog_title": catalog_item.title if catalog_item else None,
        "area": catalog_item.area if catalog_item else "Custom",
        "title": document_title(document),
        "custom_title": document.custom_title,
        "owner": document.owner,
        "status": document.status,
        "storage_link": document.storage_link,
        "last_review_date": document.last_review_date,
        "next_review_date": document.next_review_date,
        "review_frequency_months": document.review_frequency_months,
        "effective_review_frequency_months": review_months,
        "recommended_owner_role": catalog_item.default_owner_role if catalog_item else None,
        "notes": document.notes,
        "tags": clean_tags(document.tags),
        "needs_owner": flags["needs_owner"],
        "overdue": flags["overdue"],
        "due_soon": flags["due_soon"],
        "archived": is_archived(document),
        "updated_at": document.updated_at,
    }


def serialize_catalog_item(
    item: CatalogItem,
    documents: Iterable[Document],
    due_soon_days: int,
    today: date,
) -> dict[str, Any]:
    mapped_documents = [document for document in documents if not is_archived(document)]
    doc_payloads = [serialize_document(document, due_soon_days, today) for document in mapped_documents]

    return {
        "id": item.id,
        "code": item.code,
        "title": item.title,
        "area": item.area,
        "description_en": item.description_en,
        "description_sv": item.description_sv,
        "required": item.required,
        "active": item.active,
        "default_owner_role": item.default_owner_role,
        "review_frequency_months": item.review_frequency_months,
        "tisax_tags": clean_tags(item.tisax_tags),
        "coverage_count": len(mapped_documents),
        "missing": bool(item.active and item.required and not mapped_documents),
        "needs_owner_count": sum(1 for payload in doc_payloads if payload["needs_owner"]),
        "due_soon_count": sum(1 for payload in doc_payloads if payload["due_soon"]),
        "overdue_count": sum(1 for payload in doc_payloads if payload["overdue"]),
    }


def build_dashboard(
    catalog_items: list[CatalogItem],
    documents: list[Document],
    due_soon_days: int,
    today: date,
) -> dict[str, Any]:
    catalog_map: dict[int, list[Document]] = defaultdict(list)
    for document in documents:
        if document.catalog_item_id is not None:
            catalog_map[document.catalog_item_id].append(document)

    document_payloads = [serialize_document(document, due_soon_days, today) for document in documents]

    required_catalog = [item for item in catalog_items if item.active and item.required]
    covered_required = sum(1 for item in required_catalog if any(not is_archived(document) for document in catalog_map.get(item.id, [])))
    coverage_percent = round((covered_required / len(required_catalog)) * 100) if required_catalog else 100

    alerts: list[dict[str, str]] = []
    for item in catalog_items:
        payload = serialize_catalog_item(item, catalog_map.get(item.id, []), due_soon_days, today)
        if payload["missing"]:
            alerts.append(
                {
                    "kind": "missing",
                    "severity": "high",
                    "title": item.title,
                    "detail": f"Missing required TISAX document in {item.area}.",
                }
            )

    for payload in document_payloads:
        if payload["overdue"]:
            alerts.append(
                {
                    "kind": "overdue",
                    "severity": "high",
                    "title": payload["title"],
                    "detail": "Review date has passed. Review and update the linked evidence.",
                }
            )
        elif payload["needs_owner"]:
            alerts.append(
                {
                    "kind": "needs_owner",
                    "severity": "medium",
                    "title": payload["title"],
                    "detail": "Document has no owner assigned.",
                }
            )
        elif payload["due_soon"]:
            alerts.append(
                {
                    "kind": "due_soon",
                    "severity": "low",
                    "title": payload["title"],
                    "detail": "Review date is approaching soon.",
                }
            )

    severity_rank = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda item: (severity_rank[item["severity"]], item["title"]))

    upcoming_reviews = sorted(
        [payload for payload in document_payloads if not payload["archived"] and payload["next_review_date"]],
        key=lambda payload: (payload["next_review_date"], payload["title"]),
    )[:5]

    return {
        "summary": {
            "total_documents": len(document_payloads),
            "active_documents": sum(1 for payload in document_payloads if not payload["archived"]),
            "coverage_percent": coverage_percent,
            "missing_required": sum(1 for alert in alerts if alert["kind"] == "missing"),
            "needs_owner": sum(1 for payload in document_payloads if payload["needs_owner"]),
            "due_soon": sum(1 for payload in document_payloads if payload["due_soon"]),
            "overdue": sum(1 for payload in document_payloads if payload["overdue"]),
        },
        "alerts": alerts[:10],
        "upcoming_reviews": upcoming_reviews,
    }


def filter_documents(
    documents: list[dict[str, Any]],
    query: str | None = None,
    status: str | None = None,
    area: str | None = None,
    attention: str | None = None,
) -> list[dict[str, Any]]:
    filtered = documents

    if query:
        needle = query.strip().lower()
        filtered = [
            document
            for document in filtered
            if needle in document["title"].lower()
            or needle in (document["owner"] or "").lower()
            or needle in (document["catalog_code"] or "").lower()
            or needle in (document["area"] or "").lower()
            or needle in (document["notes"] or "").lower()
            or any(needle in tag.lower() for tag in document["tags"])
        ]

    if status and status != "all":
        filtered = [document for document in filtered if document["status"] == status]

    if area and area != "all":
        filtered = [document for document in filtered if (document["area"] or "Custom") == area]

    if attention and attention != "all":
        if attention == "needs_owner":
            filtered = [document for document in filtered if document["needs_owner"]]
        elif attention == "due_soon":
            filtered = [document for document in filtered if document["due_soon"]]
        elif attention == "overdue":
            filtered = [document for document in filtered if document["overdue"]]
        elif attention == "healthy":
            filtered = [
                document
                for document in filtered
                if not document["needs_owner"] and not document["due_soon"] and not document["overdue"]
            ]

    return sorted(filtered, key=lambda document: (document["archived"], document["title"].lower()))
