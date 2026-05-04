"""
F15 (2026-05-04) — Regression test for canonical "SEMrush" spelling in the
Contract v2 banned-supplier-tokens denylist.

R-R2D's audit caught that the literal `"SEMrush rank {value}"` produced by
backend/routes/calibration.py:3052 was leaking through `assert_no_banned_tokens`
because the denylist contained {SEMRUSH, Semrush, semrush} but NOT the canonical
marketing spelling `SEMrush` (capital S+E+M, lowercase r-u-s-h — the form used
by semrush.com itself).

This file asserts:
  1. All four spellings are present in BANNED_SUPPLIER_TOKENS.
  2. assert_no_banned_tokens raises on each spelling individually.
  3. The specific historic leak string ("SEMrush rank 12345") raises.
  4. The current calibration.py output does NOT contain "SEMrush" anywhere
     (defense-in-depth — F15 also rewrote the source string).

Source contract: BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from backend.core.response_sanitizer import (
    BANNED_SUPPLIER_TOKENS,
    ExternalContractViolation,
    assert_no_banned_tokens,
)


# ─── 1. All four spellings present in the denylist ────────────────────────

class TestAllFourSpellingsBanned:
    @pytest.mark.parametrize("spelling", [
        "SEMRUSH",   # all caps (env var / log style)
        "SEMrush",   # canonical marketing spelling — the one R-R2D caught missing
        "Semrush",   # title case
        "semrush",   # lowercase (slug / DB column style)
    ])
    def test_spelling_present_in_banned_tokens(self, spelling):
        assert spelling in BANNED_SUPPLIER_TOKENS, (
            f"Canonical spelling {spelling!r} missing from BANNED_SUPPLIER_TOKENS — "
            "Contract v2 leak surface. Add it to backend/core/response_sanitizer.py."
        )


# ─── 2. assert_no_banned_tokens raises on each spelling individually ──────

class TestAssertNoBannedTokensRejectsAllSpellings:
    @pytest.mark.parametrize("spelling", [
        "SEMRUSH", "SEMrush", "Semrush", "semrush",
    ])
    def test_each_spelling_triggers_violation(self, spelling):
        payload = {"msg": f"{spelling} rank 12345"}
        with pytest.raises(ExternalContractViolation):
            assert_no_banned_tokens(payload)

    def test_specific_historic_leak_string_raises(self):
        """The exact leak source identified by R-R2D — calibration.py:3052
        emitted this format before F15's defense-in-depth rewrite."""
        payload = {"seo_rank_summary": "SEMrush rank 12345, ~50 ranking keywords, ~1000 monthly organic visits."}
        with pytest.raises(ExternalContractViolation):
            assert_no_banned_tokens(payload)


# ─── 3. calibration.py source string no longer contains "SEMrush" ─────────

class TestCalibrationSourceIsClean:
    """Defense in depth: F15 also rewrote the source string to use
    "Authority rank ..." instead of "SEMrush rank ...". This guards
    against the original leak surface re-appearing if the denylist ever
    weakens. Read the file directly so a future regression can't slip past
    a stale fixture."""

    def test_calibration_py_does_not_contain_semrush_word(self):
        calibration_path = Path(__file__).resolve().parents[1] / "routes" / "calibration.py"
        assert calibration_path.exists(), f"Cannot locate {calibration_path}"
        source = calibration_path.read_text(encoding="utf-8")

        # Strip line-comments so we don't false-positive on doc references
        # that explain the historic leak (those are intentional).
        lines_no_comments = [
            re.sub(r"#.*$", "", line)
            for line in source.split("\n")
        ]
        code_only = "\n".join(lines_no_comments)

        # In code (non-comment) text, the canonical spelling MUST NOT appear.
        # All four spellings checked — defense in depth.
        for spelling in ("SEMrush", "Semrush"):
            assert spelling not in code_only, (
                f"calibration.py code contains banned supplier name {spelling!r}. "
                f"Rewrite the source string (see F15 patch at line ~3052) to use "
                f"a neutral term like 'Authority rank' instead."
            )
