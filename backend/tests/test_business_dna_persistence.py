"""
Persistence-contract tests for `business_dna_enrichment`.

P0 Marjo Critical Incident — E5 mission, 2026-05-04.
Cites: BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2,
       feedback_zero_401_tolerance, ops_daily_calibration_check.

Pure-Python tests against the chokepoint module
`backend.core.business_dna_persistence`. No FastAPI / no live Supabase —
the SB client is a recorder mock that asserts exactly what payload would
have been written to which table.

The four mission-required tests:
  1. test_scan_writes_dna_row_with_required_fields
  2. test_dna_row_no_duplicate_per_scan_id   (uses business_profile_id —
     the actual production discriminator; see module docstring re: why
     `scan_id` is not a column on this table)
  3. test_ai_errors_never_in_response_payload
  4. test_ai_errors_population_writes_incident
"""

from __future__ import annotations

from typing import Any, Dict, List

import pytest

from backend.core.business_dna_persistence import (
    DATA_AVAILABLE,
    DEGRADED,
    INCIDENT_TABLE,
    INSUFFICIENT_SIGNAL,
    REQUIRED_FIELDS,
    derive_core_signals,
    extract_ai_errors,
    safe_upsert_business_dna,
    validate_required,
)
from backend.core.response_sanitizer import sanitize_enrichment_for_external


# ─── Recorder mock Supabase client ────────────────────────────────────────

class _MockExecuteResult:
    def __init__(self, data: Any = None):
        self.data = data or []


class _MockTable:
    def __init__(self, recorder: List[Dict[str, Any]], name: str, fail_on_first_upsert: bool = False):
        self._recorder = recorder
        self._name = name
        self._action: Dict[str, Any] = {}
        self._fail_on_first_upsert = fail_on_first_upsert

    def upsert(self, payload: Dict[str, Any], on_conflict: str = ""):
        self._action = {
            "table": self._name,
            "op": "upsert",
            "payload": payload,
            "on_conflict": on_conflict,
        }
        return self

    def insert(self, payload: Dict[str, Any]):
        self._action = {
            "table": self._name,
            "op": "insert",
            "payload": payload,
        }
        return self

    def execute(self) -> _MockExecuteResult:
        # Record AFTER execute so failures (raised from execute) don't
        # leave a half-recorded action.
        if self._fail_on_first_upsert and self._action.get("op") == "upsert":
            self._fail_on_first_upsert = False
            raise RuntimeError("simulated upsert failure")
        self._recorder.append(self._action)
        return _MockExecuteResult([{"id": "00000000-0000-0000-0000-000000000001"}])


class _MockSB:
    def __init__(self, fail_on_upsert: bool = False):
        self.actions: List[Dict[str, Any]] = []
        self._fail_on_upsert = fail_on_upsert

    def table(self, name: str) -> _MockTable:
        return _MockTable(
            self.actions,
            name,
            fail_on_first_upsert=(self._fail_on_upsert and name == "business_dna_enrichment"),
        )

    # Convenience accessors used by the tests.
    def upserts_to(self, table_name: str) -> List[Dict[str, Any]]:
        return [a for a in self.actions if a.get("table") == table_name and a.get("op") == "upsert"]

    def inserts_to(self, table_name: str) -> List[Dict[str, Any]]:
        return [a for a in self.actions if a.get("table") == table_name and a.get("op") == "insert"]


# ─── Fixtures ─────────────────────────────────────────────────────────────

USER_ID = "11111111-1111-1111-1111-111111111111"
PROFILE_ID = "22222222-2222-2222-2222-222222222222"
URL = "https://smsglobal.com"


def _healthy_enrichment() -> Dict[str, Any]:
    """A scan that captured everything cleanly. business_name + industry
    populated, multiple intelligence sections carry signal, no ai_errors.
    Should persist as DATA_AVAILABLE with derived core_signals."""
    return {
        "business_name": "SMSGlobal",
        "industry": "SMS / CPaaS",
        "competitors": ["twilio.com", "messagebird.com"],
        "swot": {
            "strengths": ["Strong brand"],
            "weaknesses": ["Few backlinks"],
            "opportunities": ["Untapped paid search"],
            "threats": ["Rising competitor activity"],
        },
        "executive_summary": "SMS gateway with API integration focus.",
        "trust_signals": ["10+ years operating", "ISO 27001"],
        "digital_footprint": {"score": 78, "seo_score": 70, "social_score": 80, "content_score": 84},
    }


def _enrichment_with_ai_errors() -> Dict[str, Any]:
    """The exact P0 shape: industry + business_name present, but ai_errors
    populated by upstream supplier failures. Per the contract, the
    persistence chokepoint MUST strip ai_errors AND emit an incident."""
    base = _healthy_enrichment()
    base["ai_errors"] = [
        {"function": "semrush-domain-intel", "status": 401, "error": "401 from supplier"},
        {"function": "browse-ai-reviews",    "status": 503, "error": "supplier 503"},
    ]
    return base


def _enrichment_missing_required() -> Dict[str, Any]:
    """Scan that produced a business_name but no industry and no signals —
    the mission's INSUFFICIENT_SIGNAL escape valve must be set automatically
    by the chokepoint."""
    return {
        "business_name": "Mystery Co",
        # industry deliberately empty
        "industry": "",
        # no signal-bearing fields
    }


# ─── Tests — required-fields + scan→row path ──────────────────────────────

class TestSafeUpsertWritesRowWithRequiredFields:
    """Mission test #1: test_scan_writes_dna_row_with_required_fields."""

    def test_writes_exactly_one_upsert_to_business_dna_enrichment(self):
        sb = _MockSB()
        report = safe_upsert_business_dna(
            sb,
            user_id=USER_ID,
            business_profile_id=PROFILE_ID,
            website_url=URL,
            enrichment=_healthy_enrichment(),
        )
        upserts = sb.upserts_to("business_dna_enrichment")
        assert len(upserts) == 1
        assert report["wrote_row"] is True
        assert report["ok"] is True

    def test_persisted_row_has_all_required_fields(self):
        sb = _MockSB()
        safe_upsert_business_dna(
            sb,
            user_id=USER_ID,
            business_profile_id=PROFILE_ID,
            website_url=URL,
            enrichment=_healthy_enrichment(),
        )
        upsert = sb.upserts_to("business_dna_enrichment")[0]
        row = upsert["payload"]
        assert row["user_id"] == USER_ID
        assert row["business_profile_id"] == PROFILE_ID
        # business_name + industry survived from the input
        enrichment = row["enrichment"]
        assert enrichment["business_name"] == "SMSGlobal"
        assert enrichment["industry"] == "SMS / CPaaS"
        # core_signals derived from the source fields
        assert isinstance(enrichment["core_signals"], list)
        assert len(enrichment["core_signals"]) >= 1
        # No ai_errors on a clean scan
        assert "ai_errors" not in enrichment

    def test_validate_required_passes_on_clean_enrichment(self):
        ok, missing = validate_required(_healthy_enrichment())
        # core_signals not yet derived in raw input — validate_required
        # is therefore strict against the raw payload. The chokepoint
        # derives core_signals before re-validating, so the persisted
        # row passes. This test pins the validator's strict semantics.
        assert ok is False
        assert missing == ["core_signals"]

    def test_validate_required_passes_when_core_signals_derived(self):
        enrichment = _healthy_enrichment()
        enrichment["core_signals"] = derive_core_signals(enrichment)
        ok, missing = validate_required(enrichment)
        assert ok is True
        assert missing == []

    def test_missing_required_triggers_insufficient_signal_state(self):
        """When the scan produced no industry + no signals, the row STILL
        gets written so we have an audit trail, but truth_state is
        INSUFFICIENT_SIGNAL and an incident is recorded."""
        sb = _MockSB()
        report = safe_upsert_business_dna(
            sb,
            user_id=USER_ID,
            business_profile_id=PROFILE_ID,
            website_url=URL,
            enrichment=_enrichment_missing_required(),
        )
        assert report["wrote_row"] is True
        assert report["truth_state"] == INSUFFICIENT_SIGNAL
        assert "industry" in report["missing_required"]

        upsert = sb.upserts_to("business_dna_enrichment")[0]
        enrichment = upsert["payload"]["enrichment"]
        assert enrichment["truth_state"] == INSUFFICIENT_SIGNAL
        assert "truth_reason" in enrichment

        # Incident recorded
        incidents = sb.inserts_to(INCIDENT_TABLE)
        assert len(incidents) == 1
        assert incidents[0]["payload"]["incident_type"] == "required_fields_missing"


# ─── Tests — duplicate-write guard ────────────────────────────────────────

class TestNoDuplicateWritePerScan:
    """Mission test #2: test_dna_row_no_duplicate_per_scan_id.

    `scan_id` is not a column on the live business_dna_enrichment table
    (audited 2026-05-04, evidence/dna-table-state.txt). The actual
    discriminator is `(user_id, business_profile_id)` enforced via UNIQUE.
    These tests pin that the chokepoint forwards the on_conflict clause
    so two consecutive calls for the same (user, profile) collapse to
    one row (latest-scan-wins) instead of duplicating.
    """

    def test_upsert_uses_user_profile_on_conflict_clause(self):
        sb = _MockSB()
        safe_upsert_business_dna(
            sb,
            user_id=USER_ID,
            business_profile_id=PROFILE_ID,
            website_url=URL,
            enrichment=_healthy_enrichment(),
        )
        upsert = sb.upserts_to("business_dna_enrichment")[0]
        assert upsert["on_conflict"] == "user_id,business_profile_id"

    def test_two_calls_same_profile_both_use_upsert_no_insert(self):
        """Two scans for the same (user, profile) should both go through
        UPSERT — no raw INSERT path. The DB UNIQUE then collapses them
        into a single row (latest-scan-wins). If a future regression
        switched to insert(), this test would fail."""
        sb = _MockSB()
        safe_upsert_business_dna(sb, user_id=USER_ID, business_profile_id=PROFILE_ID,
                                 website_url=URL, enrichment=_healthy_enrichment())
        safe_upsert_business_dna(sb, user_id=USER_ID, business_profile_id=PROFILE_ID,
                                 website_url=URL, enrichment=_healthy_enrichment())
        upserts = sb.upserts_to("business_dna_enrichment")
        inserts = sb.inserts_to("business_dna_enrichment")
        assert len(upserts) == 2  # one per scan
        assert len(inserts) == 0  # never insert directly
        # Both upserts use the same on_conflict — the UNIQUE will dedupe
        for u in upserts:
            assert u["on_conflict"] == "user_id,business_profile_id"

    def test_two_calls_different_profile_get_independent_upserts(self):
        """A different business_profile_id under the same user IS a
        different scan target — should produce two separate upserts.
        Pins that the chokepoint isn't accidentally collapsing on user_id
        alone."""
        sb = _MockSB()
        safe_upsert_business_dna(sb, user_id=USER_ID, business_profile_id=PROFILE_ID,
                                 website_url=URL, enrichment=_healthy_enrichment())
        safe_upsert_business_dna(sb, user_id=USER_ID,
                                 business_profile_id="33333333-3333-3333-3333-333333333333",
                                 website_url="https://other.com",
                                 enrichment=_healthy_enrichment())
        upserts = sb.upserts_to("business_dna_enrichment")
        assert len(upserts) == 2
        profile_ids = {u["payload"]["business_profile_id"] for u in upserts}
        assert len(profile_ids) == 2


# ─── Tests — ai_errors stripping (Contract v2) ────────────────────────────

class TestAiErrorsNeverInResponsePayload:
    """Mission test #3: test_ai_errors_never_in_response_payload.

    Pins that ai_errors is stripped at TWO boundaries:
      a) the persisted DB row (this PR's chokepoint)
      b) the external response (existing sanitize_enrichment_for_external)

    Together these mean the ai_errors array exists for at most a few
    milliseconds in process memory and never reaches storage or UI.
    """

    def test_ai_errors_stripped_from_persisted_row(self):
        sb = _MockSB()
        safe_upsert_business_dna(
            sb,
            user_id=USER_ID,
            business_profile_id=PROFILE_ID,
            website_url=URL,
            enrichment=_enrichment_with_ai_errors(),
        )
        upsert = sb.upserts_to("business_dna_enrichment")[0]
        enrichment = upsert["payload"]["enrichment"]
        assert "ai_errors" not in enrichment

    def test_ai_errors_stripped_from_external_response(self):
        """The sanitizer (existing infra) strips ai_errors from external
        responses. Pinned here so a regression to either layer fails."""
        result = sanitize_enrichment_for_external(_enrichment_with_ai_errors())
        assert "ai_errors" not in result["enrichment"]

    def test_persisted_row_marks_truth_state_degraded(self):
        sb = _MockSB()
        safe_upsert_business_dna(
            sb,
            user_id=USER_ID,
            business_profile_id=PROFILE_ID,
            website_url=URL,
            enrichment=_enrichment_with_ai_errors(),
        )
        upsert = sb.upserts_to("business_dna_enrichment")[0]
        enrichment = upsert["payload"]["enrichment"]
        assert enrichment["truth_state"] == DEGRADED
        # Customer-facing reason — supplier-name-free
        reason = enrichment.get("truth_reason", "")
        assert reason
        for forbidden in ("semrush", "Semrush", "401", "browse-ai", "browse.ai", "OpenAI"):
            assert forbidden not in reason

    def test_extract_ai_errors_handles_list_dict_and_string(self):
        """The extractor accepts the production-observed shapes."""
        assert extract_ai_errors({}) == []
        assert extract_ai_errors({"ai_errors": []}) == []
        assert extract_ai_errors({"ai_errors": [{"a": 1}]}) == [{"a": 1}]
        # Defensive: dict shape gets wrapped so the truth-check still flags
        assert extract_ai_errors({"ai_errors": {"single": "err"}}) == [{"single": "err"}]
        assert extract_ai_errors(None) == []


# ─── Tests — incident emission ───────────────────────────────────────────

class TestAiErrorsPopulationWritesIncident:
    """Mission test #4: test_ai_errors_population_writes_incident."""

    def test_writes_one_incident_row_when_ai_errors_present(self):
        sb = _MockSB()
        safe_upsert_business_dna(
            sb,
            user_id=USER_ID,
            business_profile_id=PROFILE_ID,
            website_url=URL,
            enrichment=_enrichment_with_ai_errors(),
        )
        incidents = sb.inserts_to(INCIDENT_TABLE)
        assert len(incidents) == 1
        row = incidents[0]["payload"]
        assert row["user_id"] == USER_ID
        assert row["business_profile_id"] == PROFILE_ID
        assert row["incident_type"] == "ai_errors_present_at_persistence"
        assert row["detail"]["ai_errors_count"] == 2
        # Redacted detail preserves status + function for triage
        redacted = row["detail"]["ai_errors_redacted"]
        assert len(redacted) == 2
        assert {"function", "status", "error"} <= set(redacted[0].keys())

    def test_no_incident_when_clean_scan(self):
        sb = _MockSB()
        safe_upsert_business_dna(
            sb,
            user_id=USER_ID,
            business_profile_id=PROFILE_ID,
            website_url=URL,
            enrichment=_healthy_enrichment(),
        )
        incidents = sb.inserts_to(INCIDENT_TABLE)
        assert len(incidents) == 0

    def test_alert_queue_side_channel_emitted_on_incident(self):
        """Per the chokepoint: incident emission ALSO writes to alerts_queue
        as a side channel for ops dashboards. Failure of that channel must
        not raise (covered separately in test_alerts_queue_failure_silent)."""
        sb = _MockSB()
        safe_upsert_business_dna(
            sb,
            user_id=USER_ID,
            business_profile_id=PROFILE_ID,
            website_url=URL,
            enrichment=_enrichment_with_ai_errors(),
        )
        alerts = sb.inserts_to("alerts_queue")
        assert len(alerts) == 1
        alert = alerts[0]["payload"]
        assert alert["type"] == "persistence_incident"
        assert alert["source"] == "business_dna_persistence"
        assert alert["payload"]["incident_type"] == "ai_errors_present_at_persistence"

    def test_chokepoint_never_raises_on_upsert_failure(self):
        """Persistence failure must not crash the scan response. The
        caller still gets a sanitized response; this layer is the
        DB-side guarantee."""
        sb = _MockSB(fail_on_upsert=True)
        # Should NOT raise
        report = safe_upsert_business_dna(
            sb,
            user_id=USER_ID,
            business_profile_id=PROFILE_ID,
            website_url=URL,
            enrichment=_healthy_enrichment(),
        )
        assert report["ok"] is False
        assert report["wrote_row"] is False
        # An upsert_exception incident was recorded
        incidents = sb.inserts_to(INCIDENT_TABLE)
        types = [i["payload"]["incident_type"] for i in incidents]
        assert "upsert_exception" in types


# ─── derive_core_signals coverage ────────────────────────────────────────

class TestDeriveCoreSignals:
    def test_returns_signals_for_each_non_empty_source_field(self):
        signals = derive_core_signals(_healthy_enrichment())
        # competitors (list, len>0), swot (dict, non-empty), executive_summary,
        # trust_signals, digital_footprint → at least 5
        present_fields = {s["field"] for s in signals}
        assert "competitors" in present_fields
        assert "swot" in present_fields
        assert "executive_summary" in present_fields
        assert "trust_signals" in present_fields
        assert "digital_footprint" in present_fields

    def test_returns_empty_list_when_no_signal_fields_present(self):
        signals = derive_core_signals({"business_name": "X", "industry": "Y"})
        assert signals == []

    def test_skips_empty_dict_and_empty_list_fields(self):
        signals = derive_core_signals({
            "business_name": "X",
            "industry": "Y",
            "swot": {},                     # empty
            "competitors": [],              # empty
            "executive_summary": "  ",      # whitespace
            "trust_signals": ["solid"],     # populated
        })
        present_fields = {s["field"] for s in signals}
        assert "trust_signals" in present_fields
        assert "swot" not in present_fields
        assert "competitors" not in present_fields
        assert "executive_summary" not in present_fields


# ─── REQUIRED_FIELDS contract pin ─────────────────────────────────────────

def test_required_fields_constant_matches_mission_spec():
    """Pin the contract so a future drift (someone removing 'industry'
    from REQUIRED_FIELDS) breaks the test before it breaks production."""
    assert REQUIRED_FIELDS == ("business_name", "industry", "core_signals")
