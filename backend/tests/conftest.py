import os

import pytest

# Ensure required env vars are set before any backend module imports `settings`.
# pytest collects conftest.py before test modules, so this runs first.
os.environ.setdefault("GOOGLE_MAPS_API_KEY", "test-google-maps-key")


@pytest.fixture
def isolated_db(tmp_path, monkeypatch):
    """Each test gets a fresh SQLite file. Auto-runs init_db()."""
    db_file = tmp_path / "test.db"
    from settings import settings
    monkeypatch.setattr(settings, "DATABASE_URL", f"sqlite:///{db_file}")
    from dao.database import init_db
    init_db()
    yield db_file
