"""The 10 benchmark properties for the JobNimbus AI Roofing hackathon.

Sourced from backend/docs/benchmark-requirements-jobnimbus.md. Imported by
scripts/precache_eagleview.py and scripts/probe_benchmark_addresses.py so
both stay in sync.
"""

# 5 example addresses (calibration only — not scored)
EXAMPLE_ADDRESSES: list[str] = [
    "21106 Kenswick Meadows Ct, Humble, TX 77338",
    "5914 Copper Lilly Lane, Spring, TX 77389",
    "122 NW 13th Ave, Cape Coral, FL 33993",
    "14132 Trenton Ave, Orland Park, IL 60462",
    "835 S Cobble Creek, Nixa, MO 65714",
]

# 5 test addresses (these get submitted for actual scoring)
TEST_ADDRESSES: list[str] = [
    "3561 E 102nd Ct, Thornton, CO 80229",
    "1612 S Canton Ave, Springfield, MO 65802",
    "6310 Laguna Bay Court, Houston, TX 77041",
    "3820 E Rosebrier St, Springfield, MO 65809",
    "1261 20th Street, Newport News, VA 23607",
]

ALL_ADDRESSES: list[str] = EXAMPLE_ADDRESSES + TEST_ADDRESSES
