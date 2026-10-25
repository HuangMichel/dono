"""FastAPI composition root. No frontend or application-cookie authentication."""

from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from uuid import uuid4

import httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import Response

from app.api import (
    account,
    account_collections,
    administration,
    association_collections,
    associations,
    configuration,
    configuration_collections,
    donation_collections,
    donations,
    inventory,
    needs_parsing,
    photos,
    public_needs,
    site,
    workflow,
)
from app.config import Settings
from app.domain.errors import DomainError


def create_app(
    settings: Settings | None = None, transport: httpx.AsyncBaseTransport | None = None
) -> FastAPI:
    config = settings or Settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        async with httpx.AsyncClient(
            transport=transport, timeout=15, follow_redirects=False
        ) as client:
            application.state.http = client
            yield

    application = FastAPI(title="Dono API", version="0.1.0", lifespan=lifespan)
    application.state.settings = config

    @application.get("/health", tags=["operations"])
    async def health() -> dict[str, str]:
        """Process liveness only; does not claim downstream readiness."""
        return {"status": "ok"}

    if config.app_origin:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=[config.app_origin],
            allow_credentials=False,
            allow_methods=["GET", "POST", "PATCH", "PUT"],
            allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
        )

    @application.middleware("http")
    async def request_context(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request.state.request_id = str(uuid4())
        response = await call_next(request)
        response.headers["Cache-Control"] = "private, no-store"
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    @application.exception_handler(DomainError)
    async def domain_error(request: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.code.replace("_", " ").capitalize() + ".",
                    "request_id": request.state.request_id,
                    "retryable": exc.status >= 502,
                }
            },
        )

    @application.exception_handler(RequestValidationError)
    async def validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = [
            {"path": ".".join(str(part) for part in err["loc"]), "code": err["type"]}
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "Invalid request.",
                    "request_id": request.state.request_id,
                    "retryable": False,
                    "details": details,
                }
            },
        )

    @application.exception_handler(httpx.RequestError)
    async def upstream_failure(
        request: Request, exc: httpx.RequestError
    ) -> JSONResponse:
        return await domain_error(request, DomainError("database_unavailable", 503))

    @application.exception_handler(ResponseValidationError)
    async def response_failure(
        request: Request, exc: ResponseValidationError
    ) -> JSONResponse:
        return await domain_error(request, DomainError("internal_error", 500))

    @application.exception_handler(StarletteHTTPException)
    async def http_failure(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        return await domain_error(
            request,
            DomainError(
                "not_found" if exc.status_code == 404 else "method_not_allowed",
                exc.status_code,
            ),
        )

    application.include_router(public_needs.router)
    application.include_router(workflow.router)
    application.include_router(configuration.router)
    application.include_router(inventory.router)
    application.include_router(account_collections.router)
    application.include_router(association_collections.router)
    application.include_router(configuration_collections.router)
    application.include_router(donation_collections.router)
    application.include_router(administration.router)
    application.include_router(site.router)
    application.include_router(needs_parsing.router)
    application.include_router(account.router)
    application.include_router(associations.router)
    application.include_router(donations.router)
    application.include_router(photos.router)
    return application


app = create_app()
