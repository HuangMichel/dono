"""Government BAN through IGN address search; no route service or donor storage."""

from dataclasses import dataclass
from math import isfinite

import httpx

from app.domain.errors import DomainError


@dataclass(frozen=True, slots=True)
class Location:
    display_address: str
    latitude: float
    longitude: float
    city: str | None = None
    postcode: str | None = None


class BANGeocoder:
    def __init__(self, client: httpx.AsyncClient, base_url: str) -> None:
        self.client = client
        self.base_url = base_url.rstrip("/")

    async def geocode(
        self, address: str, *, municipality_only: bool = False
    ) -> Location:
        """Resolve an address, or restrict discovery searches to municipalities."""
        address = address.strip()
        if not 3 <= len(address) <= 200 or not address[0].isalnum():
            raise DomainError("invalid_location", 422)
        params: dict[str, str | int] = {"q": address, "index": "address", "limit": 1}
        if municipality_only:
            params["type"] = "municipality"
        try:
            response = await self.client.get(
                self.base_url + "/search",
                params=params,
                timeout=15,
            )
            if response.status_code != 200:
                raise ValueError("provider unavailable")
            feature = response.json()["features"][0]
            longitude, latitude = map(float, feature["geometry"]["coordinates"])
            label = feature["properties"]["label"]
            if (
                feature["geometry"]["type"] != "Point"
                or not isinstance(label, str)
                or not label.strip()
                or not isfinite(latitude)
                or not isfinite(longitude)
                or not (-90 <= latitude <= 90 and -180 <= longitude <= 180)
            ):
                raise ValueError("invalid location")
            properties = feature["properties"]
            if municipality_only and properties.get("type") != "municipality":
                raise ValueError("municipality required")
            city = properties.get("city")
            postcode = properties.get("postcode")
            return Location(
                label,
                latitude,
                longitude,
                city.strip() if isinstance(city, str) and city.strip() else None,
                postcode.strip()
                if isinstance(postcode, str) and postcode.strip()
                else None,
            )
        except (httpx.RequestError, ValueError, KeyError, IndexError, TypeError) as exc:
            raise DomainError("geocoding_unavailable", 503) from exc
