"""Contract lock tests for entitlement constants.

Seat model lock: Growth=1, Pro=5, Business=12.
"""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config.entitlement_constants import (
    BUSINESS_SEATS,
    BUSINESS_TOKENS,
    BUSINESS_TOPUP_CAP,
    HARD_STOP_THRESHOLD,
    PRO_SEATS,
    PRO_TOKENS,
    PRO_TOPUP_CAP,
    STARTER_SEATS,
    STARTER_TOKENS,
    STARTER_TOPUP_CAP,
    TOPUP_PRICE_AUD_CENTS,
    TOPUP_TOKENS,
    URGENT_WARNING_THRESHOLD,
    WARNING_THRESHOLD,
)
from core import plans


def test_contract_locked_seats_tokens_and_topup_values():
    assert STARTER_SEATS == 1
    assert PRO_SEATS == 5
    assert BUSINESS_SEATS == 12

    assert STARTER_TOKENS == 1_000_000
    assert PRO_TOKENS == 5_000_000
    assert BUSINESS_TOKENS == 20_000_000

    assert TOPUP_TOKENS == 250_000
    assert TOPUP_PRICE_AUD_CENTS == 1900
    assert STARTER_TOPUP_CAP == 3
    assert PRO_TOPUP_CAP == 5
    assert BUSINESS_TOPUP_CAP == 10

    assert WARNING_THRESHOLD == 0.80
    assert URGENT_WARNING_THRESHOLD == 0.95
    assert HARD_STOP_THRESHOLD == 1.00


def test_core_plans_uses_canonical_topup_values():
    assert plans.TOPUP_TOKENS == TOPUP_TOKENS
    assert plans.TOPUP_PRICE_AUD_CENTS == TOPUP_PRICE_AUD_CENTS

