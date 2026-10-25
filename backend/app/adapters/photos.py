"""Bounded byte validation and canonical database encoding."""

import base64
import binascii
import warnings
from dataclasses import dataclass
from hashlib import sha256
from io import BytesIO

from PIL import Image, UnidentifiedImageError

from app.domain.errors import DomainError

MIME = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}


@dataclass(frozen=True, slots=True)
class ValidatedPhoto:
    mime_type: str
    size_bytes: int
    sha256: str
    image_base64: str


def validate_photo(
    content: bytes, claimed_type: str, max_bytes: int, max_pixels: int
) -> ValidatedPhoto:
    if len(content) > max_bytes:
        raise DomainError("upload_too_large", 413)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as image:
                mime = MIME.get(image.format or "")
                if (
                    not mime
                    or mime != claimed_type
                    or getattr(image, "is_animated", False)
                ):
                    raise DomainError("unsupported_media_type", 415)
                if image.width * image.height > max_pixels:
                    raise DomainError("upload_too_large", 413)
                image.verify()
            with Image.open(BytesIO(content)) as decoded:
                decoded.load()
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombWarning,
        Image.DecompressionBombError,
    ) as exc:
        raise DomainError("unsupported_media_type", 415) from exc
    return ValidatedPhoto(
        mime,
        len(content),
        sha256(content).hexdigest(),
        base64.b64encode(content).decode("ascii"),
    )


def decode_photo(encoded: str, expected_size: int, expected_hash: str) -> bytes:
    try:
        content = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise DomainError("photo_integrity_error", 500) from exc
    if (
        base64.b64encode(content).decode("ascii") != encoded
        or len(content) != expected_size
        or sha256(content).hexdigest() != expected_hash
    ):
        raise DomainError("photo_integrity_error", 500)
    return content


def discovery_photo(content: bytes) -> bytes:
    """Share only rendered pixels; originals retain their immutable evidence bytes."""
    from PIL import ImageOps

    try:
        with Image.open(BytesIO(content)) as source:
            oriented = ImageOps.exif_transpose(source)
            oriented.thumbnail((1600, 1600))
            rendered = oriented.convert("RGBA")
            clean = Image.new("RGBA", rendered.size)
            clean.paste(rendered)
            output = BytesIO()
            clean.save(output, format="PNG")
            return output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise DomainError("photo_integrity_error", 500) from exc
