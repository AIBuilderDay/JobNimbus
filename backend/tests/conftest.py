import os

# Ensure required env vars are set before any backend module imports `settings`.
# pytest collects conftest.py before test modules, so this runs first.
os.environ.setdefault("GOOGLE_MAPS_API_KEY", "test-google-maps-key")
