"""Stateless Supabase access: user-scoped reads and restricted server commands."""

from uuid import UUID

import httpx

from app.config import Settings
from app.domain.errors import DomainError


class Supabase:
    def __init__(self, client: httpx.AsyncClient, settings: Settings) -> None:
        self.client = client
        self.settings = settings

    def headers(self, token: str | None = None) -> dict[str, str]:
        key = (
            self.settings.supabase_publishable_key
            if token
            else self.settings.supabase_secret_key
        )
        if not self.settings.supabase_url or not key.get_secret_value():
            raise DomainError("database_unavailable", 503)
        result = {"apikey": key.get_secret_value()}
        if token:
            result["Authorization"] = f"Bearer {token}"
        return result

    async def identity(self, token: str) -> UUID:
        """Auth server verifies the bearer; never trust decoded claims/metadata."""
        try:
            response = await self.client.get(
                self.settings.supabase_url + "/auth/v1/user",
                headers=self.headers(token),
            )
            if response.status_code in (401, 403):
                raise DomainError("invalid_token", 401)
            if response.status_code != 200:
                raise DomainError("authentication_unavailable", 503)
            return UUID(response.json()["id"])
        except (KeyError, ValueError) as exc:
            raise DomainError("invalid_token", 401) from exc
        except httpx.RequestError as exc:
            raise DomainError("authentication_unavailable", 503) from exc

    async def read(
        self, table: str, token: str, params: dict[str, str]
    ) -> list[dict[str, object]]:
        response = await self.client.get(
            self.settings.supabase_url + "/rest/v1/" + table,
            headers=self.headers(token),
            params=params,
        )
        return self._rows(response)

    async def command(
        self, name: str, actor: UUID, args: dict[str, object]
    ) -> list[dict[str, object]]:
        response = await self.client.post(
            self.settings.supabase_url + "/rest/v1/rpc/dono_" + name,
            headers=self.headers(),
            json={"actor": str(actor), **args},
        )
        return self._rows(response)

    @staticmethod
    def _rows(response: httpx.Response) -> list[dict[str, object]]:
        if response.is_error:
            try:
                error = response.json()
                if not isinstance(error, dict):
                    error = {}
                code = error.get("message", "")
            except ValueError:
                error = {}
                code = ""
            allowed = {
                "forbidden": 403,
                "account_disabled": 403,
                "not_found": 404,
                "stale_revision": 409,
                "active_offer_exists": 409,
                "invalid_transition": 409,
                "deadline_elapsed": 409,
                "demand_exhausted": 409,
                "storage_exhausted": 409,
                "intake_quota_exhausted": 409,
                "slot_full": 409,
                "configuration_below_commitment": 409,
                "last_admin_required": 409,
                "admin_recovery_not_allowed": 409,
                "duplicate_identifier": 409,
                "already_received": 409,
                "already_distributed": 409,
                "idempotency_conflict": 409,
                "request_in_progress": 409,
                "date_context_stale": 409,
                "intake_date_restriction": 409,
                "date_clarification_required": 409,
                "validation_error": 422,
                "ineligible_item": 422,
                "outside_reception_window": 422,
                "invalid_qr": 422,
                "photo_limit_reached": 422,
                "photo_integrity_error": 500,
            }
            if error.get("code") == "23505" and any(
                name in code
                for name in ("associations_rna_uk", "associations_siret_uk")
            ):
                raise DomainError("duplicate_identifier", 409)
            if code in allowed:
                raise DomainError(code, allowed[code])
            raise DomainError("database_unavailable", 503)
        data = response.json()
        if not isinstance(data, list):
            data = [data]
        return [dict(row) for row in data]
