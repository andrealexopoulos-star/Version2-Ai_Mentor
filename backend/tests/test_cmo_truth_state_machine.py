import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from cmo_truth import (  # noqa: E402
    REPORT_STATE_COMPLETE,
    REPORT_STATE_FAILED,
    REPORT_STATE_INSUFFICIENT,
    REPORT_STATE_PARTIAL,
    SECTION_DEGRADED,
    SECTION_INSUFFICIENT,
    SECTION_PLACEHOLDER,
    SECTION_SOURCE_BACKED,
    clean_string_list,
    derive_report_state,
    estimate_confidence,
    is_placeholder_text,
)


def test_placeholder_detection_flags_known_canned_language():
    assert is_placeholder_text("No data available yet")
    assert is_placeholder_text("SEO: Build a services topic cluster")


def test_clean_string_list_removes_placeholder_rows():
    cleaned = clean_string_list(
        [
            "No data available yet",
            "Insufficient review signal to assess customer sentiment yet.",
            "Evidence-backed competitor pressure from sms providers",
        ]
    )
    assert cleaned == ["Evidence-backed competitor pressure from sms providers"]


def test_report_state_is_complete_only_when_all_sections_source_backed():
    state = derive_report_state(
        [SECTION_SOURCE_BACKED, SECTION_SOURCE_BACKED, SECTION_SOURCE_BACKED]
    )
    assert state == REPORT_STATE_COMPLETE


def test_report_state_is_partial_with_mix_of_source_backed_and_degraded():
    state = derive_report_state(
        [SECTION_SOURCE_BACKED, SECTION_DEGRADED, SECTION_INSUFFICIENT]
    )
    assert state == REPORT_STATE_PARTIAL


def test_report_state_is_insufficient_when_no_source_backed_sections():
    state = derive_report_state([SECTION_INSUFFICIENT, SECTION_DEGRADED])
    assert state == REPORT_STATE_INSUFFICIENT


def test_report_state_fails_when_placeholder_detected():
    state = derive_report_state([SECTION_SOURCE_BACKED, SECTION_PLACEHOLDER])
    assert state == REPORT_STATE_FAILED


def test_confidence_scales_with_section_quality():
    confidence = estimate_confidence(
        [SECTION_SOURCE_BACKED, SECTION_DEGRADED, SECTION_INSUFFICIENT]
    )
    assert confidence == 55
