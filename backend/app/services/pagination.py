"""Opaque HMAC cursors bind identity, filters, sort and optional expiry day."""

import base64
import hashlib
import hmac
import json
from datetime import date, datetime
from typing import Any

from app.domain.errors import DomainError


class CursorPages:
    def __init__(self, key: str) -> None:
        self.key = key.encode()

    def _sign(self, body: str) -> str:
        if len(self.key) < 32:
            raise DomainError("cursor_unavailable", 503)
        return hmac.new(
            self.key, b"dono.cursor.v1/" + body.encode(), hashlib.sha256
        ).hexdigest()

    def page(
        self,
        rows: list[dict[str, Any]],
        *,
        scope: dict[str, object],
        limit: int,
        cursor: str | None,
        sort_keys: tuple[str, ...] = ("created_at", "id"),
        reverse: bool = True,
        preserve_order: bool = False,
        expiry_day: str | None = None
    ) -> tuple[list[dict[str, Any]], dict[str, object]]:
        if not 1 <= limit <= 100:
            raise DomainError("validation_error", 422)
        if not preserve_order:
            rows = sorted(
                rows,
                key=lambda row: tuple(str(row.get(key, "")) for key in sort_keys),
                reverse=reverse,
            )
        scope_hash = hashlib.sha256(
            json.dumps(scope, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        anchor = None
        start = 0
        if cursor:
            try:
                if len(cursor) > 4096:
                    raise ValueError("length")
                body, signature = cursor.split(".")
                if not hmac.compare_digest(signature, self._sign(body)):
                    raise ValueError("signature")
                value = json.loads(
                    base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))
                )
                if value["scope"] != scope_hash:
                    raise ValueError("scope")
                if value.get("expiry_day") != expiry_day:
                    raise DomainError("stale_cursor", 422)
                anchor = value["anchor"]
                if not isinstance(anchor, list):
                    raise ValueError("anchor")
            except (ValueError, KeyError, TypeError) as exc:
                raise DomainError("invalid_cursor", 422) from exc
        if anchor is not None:
            rows = [
                row
                for row in rows
                if (
                    self._key(row, sort_keys) < anchor
                    if reverse
                    else self._key(row, sort_keys) > anchor
                )
            ]
        selected = rows[start : start + limit]
        more = start + limit < len(rows)
        next_cursor = None
        if more:
            body = (
                base64.urlsafe_b64encode(
                    json.dumps(
                        {
                            "scope": scope_hash,
                            "anchor": self._key(selected[-1], sort_keys),
                            "expiry_day": expiry_day,
                        },
                        sort_keys=True,
                        separators=(",", ":"),
                    ).encode()
                )
                .decode()
                .rstrip("=")
            )
            next_cursor = body + "." + self._sign(body)
        return selected, {"next_cursor": next_cursor, "has_more": more}

    @staticmethod
    def _key(row: dict[str, Any], keys: tuple[str, ...]) -> list[Any]:
        def normalized(value: Any) -> Any:
            if isinstance(value, tuple | list):
                return [normalized(part) for part in value]
            if isinstance(value, date | datetime):
                return value.isoformat()
            return value

        return [normalized(row.get(key, "")) for key in keys]
