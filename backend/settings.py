from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    GOOGLE_MAPS_API_KEY: str
    ANTHROPIC_API_KEY: str = ""
    EAGLEVIEW_CLIENT_ID: str = ""
    EAGLEVIEW_CLIENT_SECRET: str = ""
    EAGLEVIEW_BASE_URL: str = "https://apicenter.eagleview.com"
    REPLICATE_API_TOKEN: str = ""

    DATABASE_URL: str = "sqlite:///./jobnimbus.db"

    LOG_LEVEL: str = "INFO"


settings = Settings()
