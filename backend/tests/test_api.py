from __future__ import annotations

from pathlib import Path

import pytest


def test_fresh_install_shows_seed_catalog_and_empty_documents(client) -> None:
    catalog = client.get("/api/catalog")
    documents = client.get("/api/documents")
    dashboard = client.get("/api/dashboard")

    assert catalog.status_code == 200
    assert len(catalog.json()) >= 25
    assert documents.json() == []
    assert dashboard.json()["summary"]["missing_required"] >= 1


def test_document_crud_and_dashboard_counts(client, tmp_path: Path) -> None:
    catalog = client.get("/api/catalog").json()
    first_item = catalog[0]
    linked_file = tmp_path / "policy.docx"
    linked_file.write_text("evidence", encoding="utf-8")

    create_response = client.post(
        "/api/documents",
        json={
            "catalog_item_id": first_item["id"],
            "custom_title": "Main policy",
            "owner": "Marcus",
            "status": "active",
            "storage_link": str(linked_file),
            "last_review_date": "2026-04-01",
            "review_frequency_months": 12,
            "tags": ["policy", "governance"],
        },
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["next_review_date"] == "2027-04-01"

    updated = client.patch(
        f"/api/documents/{created['id']}",
        json={"owner": "", "next_review_date": "2026-04-20", "status": "review"},
    )
    assert updated.status_code == 200
    assert updated.json()["needs_owner"] is True

    dashboard = client.get("/api/dashboard").json()
    assert dashboard["summary"]["active_documents"] == 1
    assert dashboard["summary"]["needs_owner"] == 1


def test_csv_export_matches_filter(client) -> None:
    catalog_item_id = client.get("/api/catalog").json()[0]["id"]
    client.post(
        "/api/documents",
        json={
            "catalog_item_id": catalog_item_id,
            "custom_title": "Due soon policy",
            "owner": "Owner",
            "status": "active",
            "next_review_date": "2026-04-10",
        },
    )
    client.post(
        "/api/documents",
        json={
            "catalog_item_id": catalog_item_id,
            "custom_title": "Archived policy",
            "owner": "Owner",
            "status": "archived",
        },
    )

    export_response = client.get("/api/export/documents.csv?attention=due_soon")
    assert export_response.status_code == 200
    lines = export_response.text.strip().splitlines()
    assert len(lines) == 2
    assert "Due soon policy" in lines[1]


def test_settings_and_open_link_validation(client, monkeypatch, tmp_path: Path) -> None:
    settings_response = client.patch("/api/settings", json={"workspace_name": "North Star", "due_soon_days": 14})
    assert settings_response.status_code == 200
    assert settings_response.json()["workspace_name"] == "North Star"

    catalog_item_id = client.get("/api/catalog").json()[0]["id"]
    document = client.post(
        "/api/documents",
        json={
            "catalog_item_id": catalog_item_id,
            "custom_title": "Linked file",
            "owner": "Owner",
            "status": "active",
            "storage_link": str(tmp_path / "missing-file.docx"),
        },
    ).json()

    invalid_open = client.post(f"/api/documents/{document['id']}/open-link")
    assert invalid_open.status_code == 400

    opened: list[str] = []
    valid_path = tmp_path / "present-file.docx"
    valid_path.write_text("ok", encoding="utf-8")
    client.patch(f"/api/documents/{document['id']}", json={"storage_link": str(valid_path)})

    from app import main

    if hasattr(main.os, "startfile"):
        monkeypatch.setattr(main.os, "startfile", lambda path: opened.append(str(path)))
    else:
        monkeypatch.setattr(main.webbrowser, "open", lambda value: opened.append(value))

    valid_open = client.post(f"/api/documents/{document['id']}/open-link")
    assert valid_open.status_code == 200
    assert opened


@pytest.mark.parametrize("attention_filter", ["needs_owner", "overdue", "healthy"])
def test_documents_filter_endpoint_accepts_attention_modes(client, attention_filter: str) -> None:
    response = client.get(f"/api/documents?attention={attention_filter}")
    assert response.status_code == 200
