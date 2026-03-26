from fastapi import HTTPException

from routes.reports import _build_deep_cmo_report_payload, _build_social_payload


def test_social_payload_defaults_are_deterministic():
    payload = _build_social_payload({})
    assert payload["source"] == "search"
    assert payload["social_status"] == "not_detected"
    assert payload["linkedin"] == ""
    assert payload["facebook"] == ""
    assert payload["instagram"] == ""
    assert payload["twitter"] == ""
    assert payload["youtube"] == ""


def test_build_deep_cmo_payload_requires_verified_wow_data():
    req = type("Req", (), {"wow_full": {}, "identity_signals": {}})()
    try:
        _build_deep_cmo_report_payload(req, "user-1")
        assert False, "Expected HTTPException for insufficient data"
    except HTTPException as exc:
        assert exc.status_code == 422
        assert exc.detail == "Insufficient verified data"


def test_build_deep_cmo_payload_maps_abn_and_social():
    req = type("Req", (), {
        "wow_full": {
            "business_name": "Acme Pty Ltd",
            "main_products_services": "Marketing strategy advisory",
            "target_market": "SMB founders",
            "unique_value_proposition": "Deterministic forensic growth planning",
            "cmo_executive_brief": "Executive brief text",
            "cmo_priority_actions": ["A7", "A30", "A90"],
        },
        "identity_signals": {
            "abn_verified": True,
            "abn_source": "website",
            "legal_name": "Acme Pty Ltd",
            "entity_status": "Active",
            "registered_address": "Sydney NSW",
            "abn_status": "verified",
            "social_enrichment": {
                "linkedin": "https://linkedin.com/company/acme",
                "facebook": "",
                "instagram": "",
                "twitter": "",
                "youtube": "",
                "source": "perplexity",
                "social_status": "partial",
            },
        },
    })()
    payload = _build_deep_cmo_report_payload(req, "user-1")
    assert payload["business_name"] == "Acme Pty Ltd"
    assert payload["abn_validation"]["abn_status"] == "verified"
    assert payload["social_validation"]["source"] == "perplexity"
    assert payload["roadmap_7_day"] == "A7"
    assert payload["roadmap_30_day"] == "A30"
    assert payload["roadmap_90_day"] == "A90"


def test_build_deep_cmo_payload_preserves_not_detected_states():
    req = type("Req", (), {
        "wow_full": {
            "business_name": "Acme Pty Ltd",
            "main_products_services": "Service",
        },
        "identity_signals": {
            "abn_verified": False,
            "abn_status": "not_found",
            "social_enrichment": {"social_status": "not_detected"},
        },
    })()
    payload = _build_deep_cmo_report_payload(req, "user-1")
    assert payload["abn_validation"]["abn_status"] == "not_found"
    assert payload["social_validation"]["social_status"] == "not_detected"
