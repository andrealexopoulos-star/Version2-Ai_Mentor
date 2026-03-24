from routes.soundboard_contract import (
    CONTRACT_VERSION,
    build_contract_payload,
    enforce_mode_for_tier,
    normalize_connected_sources,
    normalize_tier,
)


def test_normalize_tier_aliases_to_starter():
    assert normalize_tier("foundation") == "starter"
    assert normalize_tier("growth") == "starter"
    assert normalize_tier("starter") == "starter"
    assert normalize_tier("free") == "free"


def test_mode_enforcement_for_free_user():
    assert enforce_mode_for_tier("auto", "free") == "auto"
    assert enforce_mode_for_tier("normal", "free") == "auto"
    assert enforce_mode_for_tier("trinity", "free") == "auto"


def test_mode_enforcement_for_paid_user():
    assert enforce_mode_for_tier("normal", "starter") == "normal"
    assert enforce_mode_for_tier("trinity", "starter") == "trinity"


def test_connected_sources_normalization():
    connected = normalize_connected_sources({"crm": True, "accounting": False, "email": True, "signals": True})
    assert connected == ["crm", "email", "signals"]


def test_build_contract_payload_shape():
    payload = build_contract_payload(
        tier="foundation",
        mode_requested="trinity",
        mode_effective="trinity",
        guardrail="FULL",
        coverage_pct=88,
        confidence_score=0.92,
        data_sources_count=5,
        data_freshness="34m",
        connected_sources={"crm": True, "accounting": True, "email": False},
    )
    assert payload["version"] == CONTRACT_VERSION
    assert payload["tier"] == "starter"
    assert payload["mode_requested"] == "trinity"
    assert payload["mode_effective"] == "trinity"
    assert payload["guardrail"] == "FULL"
    assert payload["connected_sources"] == ["crm", "accounting"]
