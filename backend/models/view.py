from pydantic import BaseModel, ConfigDict


class ViewSet(BaseModel):
    model_config = ConfigDict(frozen=True)

    property_id: str
    satellite_url: str | None = None
    topdown_url: str | None = None
    abstract_payload: dict | None = None
