def test_settings_loads_with_env_vars(monkeypatch):
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "abc123")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic-key")

    from settings import Settings

    fresh = Settings()

    assert fresh.GOOGLE_MAPS_API_KEY == "abc123"
    assert fresh.ANTHROPIC_API_KEY == "anthropic-key"


def test_defaults():
    from settings import settings

    assert settings.EAGLEVIEW_BASE_URL == "https://api.eagleview.com"
    assert settings.DATABASE_URL == "sqlite:///./jobnimbus.db"
    assert settings.LOG_LEVEL == "INFO"
    assert settings.EAGLEVIEW_API_KEY == ""
    assert settings.ANTHROPIC_API_KEY == ""
