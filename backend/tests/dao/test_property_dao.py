import sqlite3

import pytest

from dao import property_dao
from models import Address


def _sample_address() -> Address:
    return Address(
        raw_input="1600 amphitheatre pkwy",
        formatted_address="1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
        lat=37.4220,
        lng=-122.0841,
        place_id="ChIJ2eUgeAK6j4ARbn5u_wAGqWA",
    )


def test_save_then_get_by_id_round_trip(isolated_db):
    addr = _sample_address()
    pid = property_dao.save(addr)
    fetched = property_dao.get_by_id(pid)
    assert fetched == addr


def test_get_by_id_returns_none_when_missing(isolated_db):
    assert property_dao.get_by_id("does-not-exist") is None


def test_get_by_address_finds_by_raw_input(isolated_db):
    addr = _sample_address()
    property_dao.save(addr)
    fetched = property_dao.get_by_address("1600 amphitheatre pkwy")
    assert fetched == addr


def test_get_by_address_finds_by_formatted(isolated_db):
    addr = _sample_address()
    property_dao.save(addr)
    fetched = property_dao.get_by_address(
        "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA"
    )
    assert fetched == addr


def test_get_by_address_returns_none_when_missing(isolated_db):
    assert property_dao.get_by_address("nowhere") is None


def test_duplicate_raw_address_raises_integrity_error(isolated_db):
    addr = _sample_address()
    property_dao.save(addr)
    with pytest.raises(sqlite3.IntegrityError):
        property_dao.save(addr)
