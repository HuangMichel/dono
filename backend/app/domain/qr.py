"""Authenticated signed booking references; state/window checks remain mandatory."""

import base64
import binascii
import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from app.domain.errors import DomainError


@dataclass(frozen=True, slots=True)
class BookingProof:
    booking_id: UUID
    association_id: UUID
    nonce: UUID
    valid_until: datetime


class QRSigner:
    def __init__(self, key: str) -> None:
        self.key = key.encode()

    def sign(self, proof: BookingProof) -> str:
        if len(self.key) < 32:
            raise DomainError("qr_unavailable", 503)
        payload = {
            "version": "dono.booking.v1",
            "kid": "v1",
            "booking_id": str(proof.booking_id),
            "association_id": str(proof.association_id),
            "nonce": str(proof.nonce),
            "valid_until": proof.valid_until.astimezone(UTC).isoformat(),
        }
        body = (
            base64.urlsafe_b64encode(
                json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
            )
            .decode()
            .rstrip("=")
        )
        signature = hmac.new(self.key, body.encode(), hashlib.sha256).hexdigest()
        return body + "." + signature

    def verify(self, payload: str, expected: BookingProof) -> None:
        if len(payload) > 2048 or not hmac.compare_digest(payload, self.sign(expected)):
            raise DomainError("invalid_qr", 422)

    def decode(self, payload: str) -> BookingProof:
        if len(self.key) < 32:
            raise DomainError("qr_unavailable", 503)
        try:
            if len(payload) > 2048:
                raise ValueError("too long")
            body, signature = payload.split(".")
            expected = hmac.new(self.key, body.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(signature, expected):
                raise ValueError("signature")
            value = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
            if value["version"] != "dono.booking.v1" or value["kid"] != "v1":
                raise ValueError("version")
            proof = BookingProof(
                UUID(value["booking_id"]),
                UUID(value["association_id"]),
                UUID(value["nonce"]),
                datetime.fromisoformat(value["valid_until"]),
            )
            self.verify(payload, proof)
            return proof
        except (ValueError, KeyError, TypeError, binascii.Error) as exc:
            raise DomainError("invalid_qr", 422) from exc
