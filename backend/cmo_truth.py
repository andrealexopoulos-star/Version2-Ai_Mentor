from __future__ import annotations

import re
from typing import Dict, Iterable, List


REPORT_STATE_COMPLETE = "COMPLETE_SOURCE_BACKED"
REPORT_STATE_PARTIAL = "PARTIAL_DEGRADED"
REPORT_STATE_INSUFFICIENT = "INSUFFICIENT_EVIDENCE"
REPORT_STATE_FAILED = "FAILED"

SECTION_SOURCE_BACKED = "SOURCE_BACKED"
SECTION_DEGRADED = "DEGRADED"
SECTION_INSUFFICIENT = "INSUFFICIENT_EVIDENCE"
SECTION_PLACEHOLDER = "PLACEHOLDER_FAKE"
SECTION_ERROR = "ERROR"

_PLACEHOLDER_PATTERNS = [
    r"\bno data available yet\b",
    r"\bno recommendations yet\b",
    r"\bconnect integrations to generate\b",
    r"\binsufficient review signal\b",
    r"\benhance crm\b",
    r"\binvest in marketing\b",
    r"\bmonitor regulatory\b",
    r"\bseo:\s*build\b",
    r"\bdemand capture:\s*run\b",
    r"\bunknown_or_low_visibility\b",
]


def is_placeholder_text(value: str) -> bool:
    text = (value or "").strip().lower()
    if not text:
        return False
    return any(re.search(pattern, text) for pattern in _PLACEHOLDER_PATTERNS)


def clean_string_list(values: Iterable[str]) -> List[str]:
    cleaned: List[str] = []
    for raw in values or []:
        if not isinstance(raw, str):
            continue
        text = raw.strip()
        if not text or is_placeholder_text(text):
            continue
        cleaned.append(text)
    return cleaned


def classify_section(
    *,
    has_evidence: bool,
    degraded: bool = False,
    error: bool = False,
    has_placeholder: bool = False,
) -> str:
    if error:
        return SECTION_ERROR
    if has_placeholder:
        return SECTION_PLACEHOLDER
    if has_evidence:
        return SECTION_SOURCE_BACKED
    if degraded:
        return SECTION_DEGRADED
    return SECTION_INSUFFICIENT


def derive_report_state(section_states: Iterable[str]) -> str:
    states = list(section_states or [])
    if not states:
        return REPORT_STATE_FAILED
    if any(state in {SECTION_ERROR, SECTION_PLACEHOLDER} for state in states):
        return REPORT_STATE_FAILED
    if all(state == SECTION_SOURCE_BACKED for state in states):
        return REPORT_STATE_COMPLETE
    if any(state == SECTION_SOURCE_BACKED for state in states):
        return REPORT_STATE_PARTIAL
    if all(state in {SECTION_INSUFFICIENT, SECTION_DEGRADED} for state in states):
        return REPORT_STATE_INSUFFICIENT
    return REPORT_STATE_PARTIAL


def estimate_confidence(section_states: Iterable[str]) -> int:
    states = list(section_states or [])
    if not states:
        return 0
    weights: Dict[str, int] = {
        SECTION_SOURCE_BACKED: 100,
        SECTION_DEGRADED: 45,
        SECTION_INSUFFICIENT: 20,
        SECTION_PLACEHOLDER: 0,
        SECTION_ERROR: 0,
    }
    total = sum(weights.get(state, 0) for state in states)
    return int(round(total / len(states)))
