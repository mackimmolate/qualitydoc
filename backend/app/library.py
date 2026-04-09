from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

from sqlalchemy.orm import Session

from .db import CatalogItem, Document, LibraryFile, Settings, utcnow


SUPPORTED_LIBRARY_EXTENSIONS = {".doc", ".docx", ".xls", ".xlsx", ".pdf"}
LIBRARY_IMPORT_STATUSES = {"unmapped", "linked", "ignored"}

DATE_PATTERN = re.compile(r"\b(20\d{2}-\d{2}-\d{2})\b")
REVISION_PATTERN = re.compile(r"(?i)\brev(?:ision)?\s*([0-9]+)\b")
TOKEN_PATTERN = re.compile(r"[0-9A-Za-zÅÄÖåäö]+")
TOKEN_ALIASES = {
    "informationssakerhet": "security",
    "informationssäkerhet": "security",
    "informationssakerhetspolicy": "policy",
    "informationssäkerhetspolicy": "policy",
    "sakerhet": "security",
    "säkerhet": "security",
    "it": "it",
    "policy": "policy",
    "leverantor": "supplier",
    "leverantör": "supplier",
    "leverantorer": "supplier",
    "leverantörer": "supplier",
    "tillgangar": "asset",
    "tillgångar": "asset",
    "inventering": "inventory",
    "incidenthantering": "incident",
    "incident": "incident",
    "beredskapsplan": "continuity",
    "nodsituationsplan": "continuity",
    "nödsituationsplan": "continuity",
    "affarskontinuitet": "continuity",
    "affärskontinuitet": "continuity",
    "kontinuitet": "continuity",
    "atkomst": "access",
    "åtkomst": "access",
    "beviljande": "access",
    "utbildning": "training",
    "kompetens": "training",
    "kryptografiska": "encryption",
    "kryptering": "encryption",
    "nycklar": "key",
    "fysisk": "physical",
    "miljomassigt": "environment",
    "miljömässigt": "environment",
    "skydd": "protection",
    "revision": "audit",
    "riskbedomning": "risk",
    "riskbedömning": "risk",
    "risk": "risk",
    "efterlevnad": "compliance",
    "ledningens": "management",
    "genomgang": "review",
    "genomgång": "review",
    "drift": "operations",
    "underhall": "operations",
    "underhåll": "operations",
}


@dataclass(slots=True)
class ParsedLibraryFile:
    relative_path: str
    filename: str
    file_extension: str
    title_guess: str
    document_date: date | None
    revision: int | None
    file_modified_at: datetime | None
    file_size_bytes: int | None


def normalize_token(token: str) -> str:
    lowered = token.lower()
    ascii_like = unicodedata.normalize("NFKD", lowered).encode("ascii", "ignore").decode("ascii")
    return TOKEN_ALIASES.get(lowered, TOKEN_ALIASES.get(ascii_like, ascii_like))


def tokenize(value: str) -> set[str]:
    return {normalize_token(token) for token in TOKEN_PATTERN.findall(value) if normalize_token(token)}


def parse_library_filename(root_path: Path, file_path: Path) -> ParsedLibraryFile:
    stem = file_path.stem
    date_match = DATE_PATTERN.search(stem)
    revision_match = REVISION_PATTERN.search(stem)

    title_guess = stem
    if date_match:
        title_guess = title_guess.replace(date_match.group(1), " ")
    if revision_match:
        title_guess = title_guess.replace(revision_match.group(0), " ")

    title_guess = re.sub(r"\s*-\s*", " - ", title_guess)
    title_guess = re.sub(r"\s+", " ", title_guess)
    title_guess = title_guess.strip(" -_,")
    title_guess = title_guess or file_path.stem

    stat = file_path.stat()
    document_date = date.fromisoformat(date_match.group(1)) if date_match else None

    return ParsedLibraryFile(
        relative_path=file_path.relative_to(root_path).as_posix(),
        filename=file_path.name,
        file_extension=file_path.suffix.lower(),
        title_guess=title_guess,
        document_date=document_date,
        revision=int(revision_match.group(1)) if revision_match else None,
        file_modified_at=datetime.fromtimestamp(stat.st_mtime),
        file_size_bytes=stat.st_size,
    )


def score_catalog_match(title_guess: str, catalog_item: CatalogItem) -> int:
    left_tokens = tokenize(title_guess)
    if not left_tokens:
        return 0

    catalog_text = " ".join(
        [
            catalog_item.title,
            catalog_item.area,
            catalog_item.description_en,
            catalog_item.description_sv,
            " ".join(catalog_item.tisax_tags or []),
        ]
    )
    right_tokens = tokenize(catalog_text)
    overlap = left_tokens & right_tokens

    score = len(overlap) * 10
    if "policy" in overlap:
        score += 8
    if "risk" in overlap or "incident" in overlap or "supplier" in overlap:
        score += 4
    return score


def suggest_catalog_item(title_guess: str, catalog_items: list[CatalogItem]) -> tuple[CatalogItem | None, int]:
    best_item: CatalogItem | None = None
    best_score = 0
    for item in catalog_items:
        score = score_catalog_match(title_guess, item)
        if score > best_score:
            best_item = item
            best_score = score
    return best_item, best_score


def resolve_library_file_path(settings: Settings, library_file: LibraryFile) -> Path:
    if not settings.document_root_path:
        raise ValueError("Document root path is not configured.")

    root_path = Path(settings.document_root_path).expanduser()
    return (root_path / library_file.relative_path).resolve()


def scan_library_root(session: Session, settings: Settings, catalog_items: list[CatalogItem]) -> dict[str, object]:
    if not settings.document_root_path:
        raise ValueError("Configure a document root path before scanning the library.")

    root_path = Path(settings.document_root_path).expanduser()
    if not root_path.exists() or not root_path.is_dir():
        raise ValueError("Configured document root path does not exist or is not a folder.")

    existing_by_path = {
        library_file.relative_path: library_file
        for library_file in session.query(LibraryFile).all()
    }
    seen_paths: set[str] = set()
    discovered_count = 0
    updated_count = 0
    scanned_count = 0
    scanned_at = utcnow()

    for file_path in sorted(root_path.rglob("*")):
        if not file_path.is_file() or file_path.suffix.lower() not in SUPPORTED_LIBRARY_EXTENSIONS:
            continue

        parsed = parse_library_filename(root_path, file_path)
        seen_paths.add(parsed.relative_path)
        scanned_count += 1

        library_file = existing_by_path.get(parsed.relative_path)
        if library_file is None:
            library_file = LibraryFile(relative_path=parsed.relative_path, import_status="unmapped")
            discovered_count += 1
            session.add(library_file)
        else:
            updated_count += 1

        library_file.filename = parsed.filename
        library_file.file_extension = parsed.file_extension
        library_file.title_guess = parsed.title_guess
        library_file.document_date = parsed.document_date
        library_file.revision = parsed.revision
        library_file.file_modified_at = parsed.file_modified_at
        library_file.file_size_bytes = parsed.file_size_bytes
        library_file.is_present = True
        library_file.last_scanned_at = scanned_at

    missing_count = 0
    for relative_path, library_file in existing_by_path.items():
        if relative_path in seen_paths:
            continue
        if library_file.is_present:
            missing_count += 1
        library_file.is_present = False
        library_file.last_scanned_at = scanned_at

    settings.library_last_scanned_at = scanned_at
    session.add(settings)
    session.commit()

    return {
        "root_path": str(root_path.resolve()),
        "scanned_at": scanned_at,
        "scanned_count": scanned_count,
        "discovered_count": discovered_count,
        "updated_count": updated_count,
        "missing_count": missing_count,
    }


def serialize_library_file(
    library_file: LibraryFile,
    settings: Settings,
    catalog_items_by_id: dict[int, CatalogItem],
    documents_by_id: dict[int, Document],
    catalog_items: list[CatalogItem],
) -> dict[str, object]:
    mapped_item = catalog_items_by_id.get(library_file.catalog_item_id) if library_file.catalog_item_id else None
    suggested_item, suggestion_score = suggest_catalog_item(library_file.title_guess, catalog_items)
    linked_document = documents_by_id.get(library_file.linked_document_id) if library_file.linked_document_id else None

    absolute_path: str | None = None
    if settings.document_root_path:
        absolute_path = str((Path(settings.document_root_path).expanduser() / library_file.relative_path).resolve())

    effective_item = mapped_item or (suggested_item if suggestion_score > 0 else None)

    linked_document_title = None
    if linked_document is not None:
        linked_document_title = linked_document.custom_title or (
            linked_document.catalog_item.title if linked_document.catalog_item else "Linked document"
        )

    return {
        "id": library_file.id,
        "relative_path": library_file.relative_path,
        "absolute_path": absolute_path,
        "filename": library_file.filename,
        "file_extension": library_file.file_extension,
        "title_guess": library_file.title_guess,
        "document_date": library_file.document_date,
        "revision": library_file.revision,
        "file_modified_at": library_file.file_modified_at,
        "file_size_bytes": library_file.file_size_bytes,
        "import_status": library_file.import_status,
        "is_present": library_file.is_present,
        "catalog_item_id": library_file.catalog_item_id,
        "catalog_code": mapped_item.code if mapped_item else None,
        "catalog_title": mapped_item.title if mapped_item else None,
        "catalog_area": mapped_item.area if mapped_item else None,
        "suggested_catalog_item_id": suggested_item.id if suggested_item and suggestion_score > 0 else None,
        "suggested_catalog_code": suggested_item.code if suggested_item and suggestion_score > 0 else None,
        "suggested_catalog_title": suggested_item.title if suggested_item and suggestion_score > 0 else None,
        "suggested_catalog_area": suggested_item.area if suggested_item and suggestion_score > 0 else None,
        "suggestion_score": suggestion_score,
        "effective_catalog_area": effective_item.area if effective_item else None,
        "linked_document_id": library_file.linked_document_id,
        "linked_document_title": linked_document_title,
        "last_scanned_at": library_file.last_scanned_at,
    }


def filter_library_files(
    files: list[dict[str, object]],
    query: str | None,
    status: str | None,
    area: str | None,
    presence: str | None,
) -> list[dict[str, object]]:
    filtered = files

    if query:
        needle = query.strip().lower()
        filtered = [
            file
            for file in filtered
            if needle in str(file["title_guess"]).lower()
            or needle in str(file["filename"]).lower()
            or needle in str(file["relative_path"]).lower()
            or needle in str(file.get("catalog_title") or "").lower()
            or needle in str(file.get("suggested_catalog_title") or "").lower()
        ]

    if status and status != "all":
        filtered = [file for file in filtered if file["import_status"] == status]

    if area and area != "all":
        filtered = [file for file in filtered if file.get("effective_catalog_area") == area]

    if presence == "present":
        filtered = [file for file in filtered if file["is_present"]]
    elif presence == "missing":
        filtered = [file for file in filtered if not file["is_present"]]

    return sorted(
        filtered,
        key=lambda file: (
            not bool(file["is_present"]),
            str(file["import_status"]) == "linked",
            str(file["title_guess"]).lower(),
        ),
    )
