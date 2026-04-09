from __future__ import annotations

from datetime import date
from pathlib import Path

from app.library import parse_library_filename, score_catalog_match
from app.db import CatalogItem


def test_parse_library_filename_extracts_title_date_and_revision(tmp_path: Path) -> None:
    file_path = tmp_path / "IT- och Informationssäkerhetspolicy - 2024-05-30 Rev 4.docx"
    file_path.write_text("demo", encoding="utf-8")

    parsed = parse_library_filename(tmp_path, file_path)

    assert parsed.relative_path == file_path.name
    assert parsed.file_extension == ".docx"
    assert parsed.document_date == date(2024, 5, 30)
    assert parsed.revision == 4
    assert "Informationssäkerhetspolicy" in parsed.title_guess


def test_score_catalog_match_handles_swedish_title_tokens() -> None:
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
        tisax_tags=["policy", "security"],
    )

    assert score_catalog_match("IT- och Informationssäkerhetspolicy", item) > 0
