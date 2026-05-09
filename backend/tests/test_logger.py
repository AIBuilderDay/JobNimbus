import io
import json
import logging

from logger import get_logger


def test_returns_logger():
    log = get_logger("test.module")
    assert isinstance(log, logging.Logger)
    assert log.name == "test.module"


def test_idempotent_no_duplicate_handlers():
    get_logger("foo")
    root_handlers_first = len(logging.getLogger().handlers)
    get_logger("bar")
    get_logger("baz")
    root_handlers_after = len(logging.getLogger().handlers)
    assert root_handlers_first == root_handlers_after


def test_emits_json():
    log = get_logger("test.json")

    buf = io.StringIO()
    test_handler = logging.StreamHandler(buf)
    root = logging.getLogger()
    test_handler.setFormatter(root.handlers[0].formatter)
    log.addHandler(test_handler)

    try:
        log.info("hello world")
    finally:
        log.removeHandler(test_handler)

    payload = json.loads(buf.getvalue().strip())
    assert payload["level"] == "INFO"
    assert payload["logger"] == "test.json"
    assert payload["message"] == "hello world"
    assert "timestamp" in payload
    assert "filename" in payload
    assert "lineno" in payload
