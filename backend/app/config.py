"""Backend-only configuration; missing credentials fail at their boundary."""

from typing import Literal, Self

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        env_ignore_empty=True,
        hide_input_in_errors=True,
    )
    supabase_url: str = ""
    supabase_publishable_key: SecretStr = SecretStr("")
    supabase_secret_key: SecretStr = SecretStr("")
    openai_api_key: SecretStr = SecretStr("")
    openai_model: str = ""
    analysis_provider: Literal["openai"] = "openai"
    app_origin: str = ""
    qr_signing_key: SecretStr = SecretStr("")
    geocoding_base_url: str = "https://data.geopf.fr/geocodage/"
    photo_max_bytes: int = 5 * 1024 * 1024
    photo_max_count: int = 3
    photo_max_pixels: int = 20_000_000
    openai_timeout_seconds: float = Field(default=60, gt=0, le=60)
    analysis_lease_seconds: int = 120

    @model_validator(mode="after")
    def consistent_policy(self) -> Self:
        if (
            self.photo_max_bytes,
            self.photo_max_count,
            self.photo_max_pixels,
            self.analysis_lease_seconds,
        ) != (5242880, 3, 20_000_000, 120):
            raise ValueError(
                "Changing photo or lease policy requires a matching database "
                "migration"
            )
        self.supabase_url = self.supabase_url.rstrip("/")
        if self.app_origin and (
            "*" in self.app_origin
            or not self.app_origin.startswith(("http://", "https://"))
        ):
            raise ValueError("APP_ORIGIN must be one exact HTTP origin")
        return self
