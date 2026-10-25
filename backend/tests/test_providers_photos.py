import json
from datetime import UTC, datetime
from io import BytesIO
from uuid import uuid4

import httpx
import pytest
from PIL import Image
from test_analysis import payload

from app.adapters.openai import OpenAIAnalyzer
from app.adapters.photos import decode_photo, validate_photo
from app.config import Settings
from app.domain.errors import DomainError
from app.domain.qr import BookingProof, QRSigner


def test_photo_roundtrip_and_tamper() -> None:
    buffer = BytesIO()
    Image.new("RGB", (4, 4)).save(buffer, format="PNG")
    content = buffer.getvalue()
    photo = validate_photo(content, "image/png", 1024, 20_000_000)
    assert decode_photo(photo.image_base64, photo.size_bytes, photo.sha256) == content
    for encoded in (photo.image_base64 + "\n", photo.image_base64[:-1] + "A"):
        with pytest.raises(DomainError):
            decode_photo(encoded, photo.size_bytes, photo.sha256)
    with pytest.raises(DomainError, match="unsupported_media_type"):
        validate_photo(content, "image/jpeg", 1024, 20_000_000)
    with pytest.raises(DomainError, match="upload_too_large"):
        validate_photo(content, "image/png", 4, 20_000_000)
    with pytest.raises(DomainError, match="unsupported_media_type"):
        validate_photo(b"not an image", "image/png", 1024, 20_000_000)


@pytest.mark.parametrize(
    "case,code",
    [
        ("refusal", "provider_unavailable"),
        ("incomplete", "provider_unavailable"),
        ("invalid", "provider_invalid_output"),
        ("timeout", "provider_timeout"),
        ("429", "provider_unavailable"),
    ],
)
async def test_provider_failure_never_becomes_donation_refusal(
    case: str, code: str
) -> None:
    def upstream(request: httpx.Request) -> httpx.Response:
        if case == "timeout":
            raise httpx.ReadTimeout("timeout", request=request)
        if case == "429":
            return httpx.Response(429)
        if case == "refusal":
            return httpx.Response(
                200,
                json={
                    "status": "completed",
                    "output": [
                        {
                            "type": "message",
                            "content": [{"type": "refusal", "refusal": "Unavailable"}],
                        }
                    ],
                },
            )
        if case == "incomplete":
            return httpx.Response(200, json={"status": "incomplete"})
        return httpx.Response(
            200,
            json={
                "status": "completed",
                "output": [
                    {
                        "type": "message",
                        "content": [{"type": "output_text", "text": "{}"}],
                    }
                ],
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(upstream)) as client:
        analyzer = OpenAIAnalyzer(
            client,
            Settings(
                _env_file=None,
                openai_api_key="test-only",
                openai_model="configured-model",
            ),
        )
        with pytest.raises(DomainError, match=code):
            await analyzer.analyze([("image/png", "AA==")])


async def test_openai_request_uses_strict_five_branch_schema() -> None:
    def upstream(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        schema = body["text"]["format"]["schema"]
        assert body["store"] is False
        assert body["text"]["format"]["strict"] is True
        assert schema["additionalProperties"] is False
        assert "anyOf" not in schema
        assert (
            body["input"][0]["content"][1]["image_url"] == "data:image/png;base64,AA=="
        )
        return httpx.Response(
            200,
            json={
                "status": "completed",
                "output": [
                    {
                        "type": "message",
                        "content": [
                            {"type": "output_text", "text": json.dumps(payload())}
                        ],
                    }
                ],
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(upstream)) as client:
        result = await OpenAIAnalyzer(
            client,
            Settings(
                _env_file=None,
                openai_api_key="test-only",
                openai_model="configured-model",
            ),
        ).analyze([("image/png", "AA==")])
        assert result.category == "clothes"
        assert result.indicators[0].probability is None


def test_qr_signature_binds_all_booking_context() -> None:
    proof = BookingProof(uuid4(), uuid4(), uuid4(), datetime(2026, 10, 25, tzinfo=UTC))
    signer = QRSigner("test-key-only-32-characters-long-enough")
    token = signer.sign(proof)
    signer.verify(token, proof)
    with pytest.raises(DomainError, match="invalid_qr"):
        signer.verify(
            token,
            BookingProof(proof.booking_id, uuid4(), proof.nonce, proof.valid_until),
        )
    with pytest.raises(DomainError):
        signer.verify(token + "a", proof)
