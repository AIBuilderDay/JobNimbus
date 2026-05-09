from pydantic import BaseModel, ConfigDict, Field


class Address(BaseModel):
    model_config = ConfigDict(frozen=True)

    raw_input: str
    formatted_address: str
    lat: float
    lng: float
    place_id: str | None = None
    # Geocoding API's address_components — list of {long_name, short_name, types}
    # entries for street_number, route, locality, administrative_area_level_1, postal_code, etc.
    # Stored as-returned so we can derive city/state/zip later without a re-geocode.
    address_components: list[dict] = Field(default_factory=list)
