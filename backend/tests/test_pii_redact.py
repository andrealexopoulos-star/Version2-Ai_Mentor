"""Tests for backend/core/pii_redact.py.

Proves the redaction helpers actually mask the values we claim they do,
and that the edge cases (empty strings, non-strings, malformed input,
nested payloads) behave predictably so callers can drop them into
existing log templates without defensive code.
"""
from __future__ import annotations

import sys
from pathlib import Path

# The backend modules live at repo_root/backend/...; add that directory
# to sys.path so "from core.pii_redact import ..." works the same way
# server.py imports its siblings.
_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

import pytest  # noqa: E402

from core.pii_redact import redact_email, redact_payload, redact_phone  # noqa: E402


# ── redact_email ──────────────────────────────────────────────────────


class TestRedactEmail:
    def test_normal_email_keeps_first_char_and_domain(self) -> None:
        assert redact_email("andrew.smith@example.com") == "a***@example.com"

    def test_single_char_local_part(self) -> None:
        assert redact_email("x@y.z") == "x***@y.z"

    def test_strips_surrounding_whitespace(self) -> None:
        assert redact_email("  andre@outlook.com  ") == "a***@outlook.com"

    def test_uppercase_preserved_in_first_char(self) -> None:
        # We keep the first character verbatim rather than lower-casing
        # it — makes it easier to correlate with the customer's own
        # capitalisation if they wrote in a support ticket.
        assert redact_email("Andre@outlook.com") == "A***@outlook.com"

    def test_not_an_email_returns_stars(self) -> None:
        assert redact_email("not-an-email") == "***"

    def test_empty_string_returned_unchanged(self) -> None:
        assert redact_email("") == ""

    def test_none_returned_unchanged(self) -> None:
        assert redact_email(None) is None

    def test_non_string_returned_unchanged(self) -> None:
        assert redact_email(123) == 123

    def test_the_authenticated_user_is_still_redacted(self) -> None:
        # The helper doesn't know whether the email belongs to the
        # authenticated user — the caller decides whether to redact.
        # This test just documents the behaviour so reviewers aren't
        # surprised.
        assert "@" in redact_email("user@example.com")
        assert "user@" not in redact_email("user@example.com")


# ── redact_phone ──────────────────────────────────────────────────────


class TestRedactPhone:
    def test_australian_format_with_spaces(self) -> None:
        # +61 400 123 456 -> digits-only "61400123456" (11 digits) ->
        # mask all but last 4 -> "*******3456"
        assert redact_phone("+61 400 123 456") == "*******3456"

    def test_australian_format_no_spaces(self) -> None:
        assert redact_phone("0400123456") == "******3456"

    def test_international_with_parens(self) -> None:
        assert redact_phone("(02) 9999 1234") == "******1234"

    def test_too_short_returns_stars(self) -> None:
        assert redact_phone("123") == "***"

    def test_empty_string_returned_unchanged(self) -> None:
        assert redact_phone("") == ""

    def test_none_returned_unchanged(self) -> None:
        assert redact_phone(None) is None

    def test_non_string_returned_unchanged(self) -> None:
        assert redact_phone(12345) == 12345


# ── redact_payload ────────────────────────────────────────────────────


class TestRedactPayload:
    def test_email_and_phone_use_partial_redaction(self) -> None:
        out = redact_payload({"email": "andre@biqc.com", "phone": "+61 400 123 456"})
        assert out["email"] == "a***@biqc.com"
        assert out["phone"] == "*******3456"

    def test_other_sensitive_keys_become_redacted_placeholder(self) -> None:
        out = redact_payload(
            {
                "full_name": "Andre Alexopoulos",
                "abn": "12345678901",
                "access_token": "sk_live_deadbeef",
                "user_id": "uuid-is-not-pii",
            }
        )
        assert out["full_name"] == "<redacted>"
        assert out["abn"] == "<redacted>"
        assert out["access_token"] == "<redacted>"
        # user_id is NOT in the default sensitive set — opaque UUIDs
        # are allowed through per the audit rules.
        assert out["user_id"] == "uuid-is-not-pii"

    def test_nested_dict_is_walked(self) -> None:
        out = redact_payload(
            {
                "user": {"email": "andre@biqc.com", "role": "admin"},
                "meta": {"source": "signup"},
            }
        )
        assert out["user"]["email"] == "a***@biqc.com"
        assert out["user"]["role"] == "admin"
        assert out["meta"]["source"] == "signup"

    def test_list_of_dicts_is_walked(self) -> None:
        out = redact_payload({"users": [{"email": "a@b.c"}, {"email": "d@e.f"}]})
        assert out["users"][0]["email"] == "a***@b.c"
        assert out["users"][1]["email"] == "d***@e.f"

    def test_original_payload_is_not_mutated(self) -> None:
        original = {"email": "andre@biqc.com", "phone": "0400000000"}
        _ = redact_payload(original)
        assert original["email"] == "andre@biqc.com"
        assert original["phone"] == "0400000000"

    def test_explicit_keys_override_defaults(self) -> None:
        out = redact_payload(
            {"email": "andre@biqc.com", "nickname": "snake-eyes"},
            keys=["nickname"],
        )
        # email is NOT in the passed list, so it passes through
        assert out["email"] == "andre@biqc.com"
        assert out["nickname"] == "<redacted>"

    def test_non_dict_returned_unchanged(self) -> None:
        assert redact_payload("just a string") == "just a string"
        assert redact_payload(None) is None
        assert redact_payload(42) == 42

    def test_case_insensitive_key_match(self) -> None:
        out = redact_payload({"Email": "andre@biqc.com", "ABN": "12345678901"})
        assert out["Email"] == "a***@biqc.com"
        assert out["ABN"] == "<redacted>"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
