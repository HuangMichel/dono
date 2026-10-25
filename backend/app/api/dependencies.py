"""Per-request identity without mutable shared authentication state."""

from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.adapters.supabase import Supabase
from app.domain.errors import DomainError

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True, slots=True)
class Actor:
    id: UUID
    token: str


def database(request: Request) -> Supabase:
    return Supabase(request.app.state.http, request.app.state.settings)


async def subject(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Supabase = Depends(database),
) -> Actor:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise DomainError("unauthenticated", 401)
    return Actor(await db.identity(credentials.credentials), credentials.credentials)


async def enabled(
    actor: Actor = Depends(subject), db: Supabase = Depends(database)
) -> Actor:
    rows = await db.read(
        "profiles", actor.token, {"select": "id", "id": f"eq.{actor.id}"}
    )
    if not rows:
        raise DomainError("account_disabled", 403)
    return actor
