from __future__ import annotations

import csv
import io
import os
import webbrowser
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .config import BASE_DIR, FRONTEND_DIST_DIR, default_database_url
from .db import Base, CatalogItem, Document, LibraryFile, Settings, create_db_engine, create_session_factory
from .library import (
    LIBRARY_IMPORT_STATUSES,
    filter_library_files,
    resolve_library_file_path,
    scan_library_root,
    serialize_library_file,
)
from .migrations import run_sqlite_migrations
from .rules import (
    DOCUMENT_STATUSES,
    build_dashboard,
    clean_tags,
    derive_next_review,
    filter_documents,
    serialize_catalog_item,
    serialize_document,
)
from .schemas import (
    CatalogItemRead,
    CatalogItemUpdate,
    DashboardRead,
    DocumentRead,
    DocumentUpdate,
    DocumentWrite,
    LibraryFileRead,
    LibraryFileUpdate,
    LibraryScanRead,
    OpenLinkResponse,
    SettingsRead,
    SettingsUpdate,
)
from .seed import seed_initial_data


def create_app(database_url: str | None = None) -> FastAPI:
    database_url = database_url or default_database_url()
    engine = create_db_engine(database_url)
    session_factory = create_session_factory(engine)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        Base.metadata.create_all(bind=engine)
        run_sqlite_migrations(engine)
        Base.metadata.create_all(bind=engine)
        with session_factory() as session:
            seed_initial_data(session)
        yield
        engine.dispose()

    app = FastAPI(title="QualityDoc API", version="1.1.0", lifespan=lifespan)
    app.state.session_factory = session_factory

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:4173", "http://localhost:4173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def get_session(request: Request):
        session = request.app.state.session_factory()
        try:
            yield session
        finally:
            session.close()

    def get_settings(session: Session) -> Settings:
        settings = session.get(Settings, 1)
        if settings is None:
            settings = Settings(
                id=1,
                workspace_name="QualityDoc",
                notification_enabled=False,
                due_soon_days=30,
                document_root_path=None,
                library_last_scanned_at=None,
            )
            session.add(settings)
            session.commit()
            session.refresh(settings)
        elif settings.document_root_path is None:
            local_candidate = (BASE_DIR / "Total dokument 240326").resolve()
            if local_candidate.exists() and local_candidate.is_dir():
                settings.document_root_path = str(local_candidate)
                session.add(settings)
                session.commit()
                session.refresh(settings)
        return settings

    def settings_to_payload(settings: Settings) -> SettingsRead:
        return SettingsRead(
            workspace_name=settings.workspace_name,
            notification_enabled=settings.notification_enabled,
            due_soon_days=settings.due_soon_days,
            document_root_path=settings.document_root_path,
            library_last_scanned_at=settings.library_last_scanned_at,
        )

    def read_documents(session: Session) -> list[Document]:
        return session.scalars(
            select(Document).options(selectinload(Document.catalog_item)).order_by(Document.updated_at.desc())
        ).all()

    def read_catalog_items(session: Session) -> list[CatalogItem]:
        return session.scalars(select(CatalogItem).order_by(CatalogItem.area, CatalogItem.title)).all()

    def read_library_files(session: Session) -> list[LibraryFile]:
        return session.scalars(
            select(LibraryFile)
            .options(
                selectinload(LibraryFile.catalog_item),
                selectinload(LibraryFile.linked_document).selectinload(Document.catalog_item),
            )
            .order_by(LibraryFile.title_guess, LibraryFile.filename)
        ).all()

    def normalize_text(value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    def document_to_payload(document: Document, settings: Settings) -> dict:
        return serialize_document(document, settings.due_soon_days, today=date.today())

    def library_file_to_payload(
        library_file: LibraryFile,
        settings: Settings,
        catalog_items: list[CatalogItem],
        documents_by_id: dict[int, Document],
    ) -> dict:
        catalog_items_by_id = {item.id: item for item in catalog_items}
        return serialize_library_file(library_file, settings, catalog_items_by_id, documents_by_id, catalog_items)

    def open_resource(link: str) -> None:
        parsed = urlparse(link)
        if parsed.scheme in {"http", "https"}:
            webbrowser.open(link)
            return

        candidate = Path(link).expanduser()
        if not candidate.is_absolute():
            candidate = candidate.resolve()
        if not candidate.exists():
            raise HTTPException(status_code=400, detail="Linked file does not exist.")

        if os.name == "nt":
            os.startfile(candidate)  # type: ignore[attr-defined]
            return

        webbrowser.open(candidate.as_uri())

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/dashboard", response_model=DashboardRead)
    def dashboard(session: Session = Depends(get_session)):
        settings = get_settings(session)
        return build_dashboard(read_catalog_items(session), read_documents(session), settings.due_soon_days, date.today())

    @app.get("/api/catalog", response_model=list[CatalogItemRead])
    def catalog(session: Session = Depends(get_session)):
        settings = get_settings(session)
        documents = read_documents(session)
        documents_by_catalog: dict[int, list[Document]] = {}
        for document in documents:
            if document.catalog_item_id is None:
                continue
            documents_by_catalog.setdefault(document.catalog_item_id, []).append(document)

        return [
            serialize_catalog_item(item, documents_by_catalog.get(item.id, []), settings.due_soon_days, date.today())
            for item in read_catalog_items(session)
        ]

    @app.patch("/api/catalog/{catalog_item_id}", response_model=CatalogItemRead)
    def update_catalog_item(catalog_item_id: int, payload: CatalogItemUpdate, session: Session = Depends(get_session)):
        item = session.get(CatalogItem, catalog_item_id)
        if item is None:
            raise HTTPException(status_code=404, detail="Catalog item not found.")

        updates = payload.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(item, field, value)

        session.add(item)
        session.commit()
        session.refresh(item)

        settings = get_settings(session)
        documents = [document for document in read_documents(session) if document.catalog_item_id == item.id]
        return serialize_catalog_item(item, documents, settings.due_soon_days, date.today())

    @app.get("/api/documents", response_model=list[DocumentRead])
    def list_documents(
        query: str | None = Query(default=None),
        status: str | None = Query(default=None),
        area: str | None = Query(default=None),
        attention: str | None = Query(default=None),
        session: Session = Depends(get_session),
    ):
        settings = get_settings(session)
        documents = [document_to_payload(document, settings) for document in read_documents(session)]
        return filter_documents(documents, query=query, status=status, area=area, attention=attention)

    @app.post("/api/documents", response_model=DocumentRead, status_code=201)
    def create_document(payload: DocumentWrite, session: Session = Depends(get_session)):
        catalog_item = session.get(CatalogItem, payload.catalog_item_id) if payload.catalog_item_id else None
        if payload.catalog_item_id and catalog_item is None:
            raise HTTPException(status_code=404, detail="Catalog item not found.")

        review_months = payload.review_frequency_months or (catalog_item.review_frequency_months if catalog_item else None)
        next_review_date = payload.next_review_date or derive_next_review(payload.last_review_date, review_months)
        document = Document(
            catalog_item_id=payload.catalog_item_id,
            custom_title=normalize_text(payload.custom_title),
            owner=normalize_text(payload.owner),
            status=payload.status,
            storage_link=normalize_text(payload.storage_link),
            last_review_date=payload.last_review_date,
            next_review_date=next_review_date,
            review_frequency_months=payload.review_frequency_months,
            notes=normalize_text(payload.notes),
            tags=clean_tags(payload.tags),
        )
        session.add(document)
        session.commit()
        session.refresh(document)

        settings = get_settings(session)
        hydrated = session.scalar(select(Document).where(Document.id == document.id).options(selectinload(Document.catalog_item)))
        return document_to_payload(hydrated, settings)

    @app.patch("/api/documents/{document_id}", response_model=DocumentRead)
    def update_document(document_id: int, payload: DocumentUpdate, session: Session = Depends(get_session)):
        document = session.scalar(select(Document).where(Document.id == document_id).options(selectinload(Document.catalog_item)))
        if document is None:
            raise HTTPException(status_code=404, detail="Document not found.")

        updates = payload.model_dump(exclude_unset=True)
        if "status" in updates and updates["status"] and updates["status"] not in DOCUMENT_STATUSES:
            raise HTTPException(status_code=400, detail="Unsupported document status.")

        if "catalog_item_id" in updates and updates["catalog_item_id"] is not None:
            catalog_item = session.get(CatalogItem, updates["catalog_item_id"])
            if catalog_item is None:
                raise HTTPException(status_code=404, detail="Catalog item not found.")

        if "tags" in updates and updates["tags"] is not None:
            updates["tags"] = clean_tags(updates["tags"])

        for text_field in ("custom_title", "owner", "storage_link", "notes"):
            if text_field in updates:
                updates[text_field] = normalize_text(updates[text_field])

        for field, value in updates.items():
            setattr(document, field, value)

        effective_months = document.review_frequency_months
        if effective_months is None and document.catalog_item:
            effective_months = document.catalog_item.review_frequency_months

        if "next_review_date" not in updates:
            document.next_review_date = derive_next_review(document.last_review_date, effective_months)

        session.add(document)
        session.commit()

        hydrated = session.scalar(select(Document).where(Document.id == document_id).options(selectinload(Document.catalog_item)))
        settings = get_settings(session)
        return document_to_payload(hydrated, settings)

    @app.get("/api/library/files", response_model=list[LibraryFileRead])
    def list_library_files(
        query: str | None = Query(default=None),
        status: str | None = Query(default=None),
        area: str | None = Query(default=None),
        presence: str | None = Query(default="present"),
        session: Session = Depends(get_session),
    ):
        settings = get_settings(session)
        catalog_items = read_catalog_items(session)
        documents = read_documents(session)
        documents_by_id = {document.id: document for document in documents}
        library_files = [
            library_file_to_payload(library_file, settings, catalog_items, documents_by_id)
            for library_file in read_library_files(session)
        ]
        return filter_library_files(library_files, query=query, status=status, area=area, presence=presence)

    @app.post("/api/library/scan", response_model=LibraryScanRead)
    def scan_library(session: Session = Depends(get_session)):
        settings = get_settings(session)
        try:
            return scan_library_root(session, settings, read_catalog_items(session))
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    @app.patch("/api/library/files/{library_file_id}", response_model=LibraryFileRead)
    def update_library_file(library_file_id: int, payload: LibraryFileUpdate, session: Session = Depends(get_session)):
        library_file = session.scalar(
            select(LibraryFile)
            .where(LibraryFile.id == library_file_id)
            .options(
                selectinload(LibraryFile.catalog_item),
                selectinload(LibraryFile.linked_document).selectinload(Document.catalog_item),
            )
        )
        if library_file is None:
            raise HTTPException(status_code=404, detail="Library file not found.")

        updates = payload.model_dump(exclude_unset=True)
        if "import_status" in updates and updates["import_status"] not in LIBRARY_IMPORT_STATUSES:
            raise HTTPException(status_code=400, detail="Unsupported library import status.")

        if "catalog_item_id" in updates and updates["catalog_item_id"] is not None:
            catalog_item = session.get(CatalogItem, updates["catalog_item_id"])
            if catalog_item is None:
                raise HTTPException(status_code=404, detail="Catalog item not found.")

        for field, value in updates.items():
            setattr(library_file, field, value)

        session.add(library_file)
        session.commit()
        session.refresh(library_file)

        settings = get_settings(session)
        catalog_items = read_catalog_items(session)
        documents_by_id = {document.id: document for document in read_documents(session)}
        hydrated = session.scalar(
            select(LibraryFile)
            .where(LibraryFile.id == library_file_id)
            .options(
                selectinload(LibraryFile.catalog_item),
                selectinload(LibraryFile.linked_document).selectinload(Document.catalog_item),
            )
        )
        return library_file_to_payload(hydrated, settings, catalog_items, documents_by_id)

    @app.post("/api/library/files/{library_file_id}/open-link", response_model=OpenLinkResponse)
    def open_library_file(library_file_id: int, session: Session = Depends(get_session)):
        library_file = session.get(LibraryFile, library_file_id)
        if library_file is None:
            raise HTTPException(status_code=404, detail="Library file not found.")
        if not library_file.is_present:
            raise HTTPException(status_code=400, detail="Library file is no longer present on disk.")

        settings = get_settings(session)
        try:
            open_resource(str(resolve_library_file_path(settings, library_file)))
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

        return OpenLinkResponse(ok=True, message="Library file opened with the default system handler.")

    @app.post("/api/library/files/{library_file_id}/create-document", response_model=DocumentRead, status_code=201)
    def create_document_from_library(
        library_file_id: int,
        payload: DocumentWrite,
        session: Session = Depends(get_session),
    ):
        library_file = session.scalar(
            select(LibraryFile)
            .where(LibraryFile.id == library_file_id)
            .options(selectinload(LibraryFile.catalog_item))
        )
        if library_file is None:
            raise HTTPException(status_code=404, detail="Library file not found.")
        if not library_file.is_present:
            raise HTTPException(status_code=400, detail="Library file is no longer present on disk.")

        settings = get_settings(session)
        try:
            resolved_path = resolve_library_file_path(settings, library_file)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        if not resolved_path.exists():
            raise HTTPException(status_code=400, detail="Scanned file does not exist on disk anymore.")

        selected_catalog_item_id = payload.catalog_item_id if payload.catalog_item_id is not None else library_file.catalog_item_id
        catalog_item = session.get(CatalogItem, selected_catalog_item_id) if selected_catalog_item_id else None
        if selected_catalog_item_id and catalog_item is None:
            raise HTTPException(status_code=404, detail="Catalog item not found.")

        last_review_date = payload.last_review_date or library_file.document_date
        review_months = payload.review_frequency_months or (catalog_item.review_frequency_months if catalog_item else None)
        next_review_date = payload.next_review_date or derive_next_review(last_review_date, review_months)

        document = Document(
            catalog_item_id=selected_catalog_item_id,
            custom_title=normalize_text(payload.custom_title),
            owner=normalize_text(payload.owner),
            status=payload.status,
            storage_link=normalize_text(payload.storage_link) or str(resolved_path),
            last_review_date=last_review_date,
            next_review_date=next_review_date,
            review_frequency_months=payload.review_frequency_months,
            notes=normalize_text(payload.notes),
            tags=clean_tags(payload.tags),
        )
        session.add(document)
        session.flush()

        library_file.catalog_item_id = selected_catalog_item_id
        library_file.linked_document_id = document.id
        library_file.import_status = "linked"
        session.add(library_file)
        session.commit()

        hydrated = session.scalar(select(Document).where(Document.id == document.id).options(selectinload(Document.catalog_item)))
        return document_to_payload(hydrated, settings)

    @app.get("/api/settings", response_model=SettingsRead)
    def read_settings(session: Session = Depends(get_session)):
        return settings_to_payload(get_settings(session))

    @app.patch("/api/settings", response_model=SettingsRead)
    def update_settings(payload: SettingsUpdate, session: Session = Depends(get_session)):
        settings = get_settings(session)
        updates = payload.model_dump(exclude_unset=True)
        if "document_root_path" in updates:
            updates["document_root_path"] = normalize_text(updates["document_root_path"])

        for field, value in updates.items():
            setattr(settings, field, value)

        session.add(settings)
        session.commit()
        session.refresh(settings)
        return settings_to_payload(settings)

    @app.post("/api/documents/{document_id}/open-link", response_model=OpenLinkResponse)
    def open_document_link(document_id: int, session: Session = Depends(get_session)):
        document = session.get(Document, document_id)
        if document is None:
            raise HTTPException(status_code=404, detail="Document not found.")
        if not document.storage_link:
            raise HTTPException(status_code=400, detail="Document has no stored link.")

        open_resource(document.storage_link)
        return OpenLinkResponse(ok=True, message="Document opened with the default system handler.")

    @app.get("/api/export/documents.csv")
    def export_documents_csv(
        query: str | None = Query(default=None),
        status: str | None = Query(default=None),
        area: str | None = Query(default=None),
        attention: str | None = Query(default=None),
        session: Session = Depends(get_session),
    ):
        settings = get_settings(session)
        documents = [document_to_payload(document, settings) for document in read_documents(session)]
        filtered = filter_documents(documents, query=query, status=status, area=area, attention=attention)

        stream = io.StringIO()
        writer = csv.writer(stream)
        writer.writerow(
            [
                "Title",
                "Catalog Code",
                "Area",
                "Owner",
                "Status",
                "Last Review",
                "Next Review",
                "Needs Owner",
                "Due Soon",
                "Overdue",
                "Link",
                "Tags",
            ]
        )
        for document in filtered:
            writer.writerow(
                [
                    document["title"],
                    document["catalog_code"] or "",
                    document["area"] or "",
                    document["owner"] or "",
                    document["status"],
                    document["last_review_date"] or "",
                    document["next_review_date"] or "",
                    "yes" if document["needs_owner"] else "no",
                    "yes" if document["due_soon"] else "no",
                    "yes" if document["overdue"] else "no",
                    document["storage_link"] or "",
                    ", ".join(document["tags"]),
                ]
            )

        return PlainTextResponse(
            stream.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="qualitydoc-documents.csv"'},
        )

    if FRONTEND_DIST_DIR.exists():
        assets_dir = FRONTEND_DIST_DIR / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

        @app.get("/", include_in_schema=False)
        def serve_root():
            return FileResponse(FRONTEND_DIST_DIR / "index.html")

        @app.get("/{full_path:path}", include_in_schema=False)
        def serve_spa(full_path: str):
            if full_path.startswith("api/"):
                raise HTTPException(status_code=404, detail="Not found.")

            candidate = (FRONTEND_DIST_DIR / full_path).resolve()
            if candidate.is_file() and FRONTEND_DIST_DIR in candidate.parents:
                return FileResponse(candidate)

            return FileResponse(FRONTEND_DIST_DIR / "index.html")

    return app


app = create_app()
