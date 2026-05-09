def test_settings_loads_with_env_vars(monkeypatch):
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "abc123")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic-key")

    from settings import Settings

    fresh = Settings()

    assert fresh.GOOGLE_MAPS_API_KEY == "abc123"
    assert fresh.ANTHROPIC_API_KEY == "anthropic-key"


def test_defaults(monkeypatch):
    # Confirm defaults independent of the developer's local .env.
    for var in ("ANTHROPIC_API_KEY", "EAGLEVIEW_API_KEY", "REPLICATE_API_TOKEN"):
        monkeypatch.delenv(var, raising=False)

    from settings import Settings

    fresh = Settings(_env_file=None)

    assert fresh.EAGLEVIEW_BASE_URL == "https://api.eagleview.com"
    assert fresh.DATABASE_URL == "sqlite:///./jobnimbus.db"
    assert fresh.LOG_LEVEL == "INFO"
    assert fresh.EAGLEVIEW_API_KEY == ""
    assert fresh.ANTHROPIC_API_KEY == ""
