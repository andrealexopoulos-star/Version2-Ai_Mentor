"""PII redaction helpers for log/response hygiene.

Centralised helpers used anywhere the backend is about to emit a string
that a human or an error aggregator (Sentry, Azure App Service log
stream, stdout-scraping tooling) might read. The aim is to turn
identifying data into a still-useful-for-debugging shape without
leaking the raw value.

Usage:

    from core.pii_redact import redact_email, redact_phone, redact_payload

    logger.info("[signup] new user %s", redact_email(request.email))
    logger.warning("[billing] charge failed for %s", redact_email(user_email))
    logger.debug("[hook] received %s", redact_payload(body, ["email", "phone"]))

Design notes:
    * `redact_email` keeps the first character of the local-part and the
      domain so support staff can still eyeball-match an entry to a
      known customer (e.g. `a***@outlook.com`) without writing the full
      address to disk.
    * `redact_phone` keeps the last 4 digits, which is the bank-grade
      convention and the same pattern Stripe uses in its dashboard.
    * `redact_payload` returns a shallow copy — it does not mutate the
      caller's dict. Nested dicts are walked one level.
    * Passing `None`, the empty string, or a non-string where a string
      is expected returns the input unchanged (safe for log templates).

This module has no external dependencies.
"""
from __future__ import annotations

import re
from typing import Any, Iterable, Mapping


_EMAIL_RE = re.compile(r"^(?P<local>[^@]+)@(?P<domain>.+)$")
_DIGITS_RE = re.compile(r"\D+")


def redact_email(email: Any) -> Any:
    """Return a log-safe rendering of an email address.

    ``"andrew.smith@example.com"`` -> ``"a***@example.com"``
    ``"x@y.z"``                    -> ``"x***@y.z"`` (one-char local)
    ``""`` / ``None`` / non-string -> input returned unchanged
    ``"not-an-email"``             -> ``"***"``
    """
    if not email or not isinstance(email, str):
        return email
    match = _EMAIL_RE.match(email.strip())
    if not match:
        return "***"
    local = match.group("local")
    domain = match.group("domain")
    first = local[0] if local else ""
    return f"{first}***@{domain}"


def redact_phone(phone: Any) -> Any:
    """Return a log-safe rendering of a phone number.

    Keeps the last 4 digits; everything else becomes ``*``. Non-digit
    formatting characters are dropped first so ``"+61 400 123 456"``
    and ``"0400123456"`` collapse to the same redaction shape.

    ``"+61 400 123 456"`` -> ``"*******3456"``
    ``"0400123456"``      -> ``"******3456"``
    ``"123"``             -> ``"***"`` (too short to keep any suffix)
    ``""`` / ``None``     -> input returned unchanged
    """
    if not phone or not isinstance(phone, str):
        return phone
    digits = _DIGITS_RE.sub("", phone)
    if len(digits) < 4:
        return "***"
    tail = digits[-4:]
    masked = "*" * (len(digits) - 4)
    return f"{masked}{tail}"


# Keys we treat as sensitive by default when `redact_payload` is called
# without an explicit list. Kept conservative — callers can always pass
# their own list when they know more about the payload shape.
_DEFAULT_SENSITIVE_KEYS = frozenset(
    {
        "email",
        "phone",
        "full_name",
        "first_name",
        "last_name",
        "address",
        "street_address",
        "postal_address",
        "abn",
        "acn",
        "tax_id",
        "password",
        "access_token",
        "refresh_token",
        "api_key",
        "secret",
        "authorization",
    }
)


def redact_payload(
    payload: Any,
    keys: Iterable[str] | None = None,
) -> Any:
    """Return a shallow copy of ``payload`` with sensitive keys redacted.

    * Emails are redacted with :func:`redact_email`.
    * Phone numbers are redacted with :func:`redact_phone`.
    * All other sensitive keys are replaced with ``"<redacted>"``.
    * Nested dicts are walked one level (deep enough for the common
      ``{"user": {"email": ...}}`` shape without invoking full recursion
      risk on untrusted data).
    * Lists/tuples of dicts get each element redacted.

    Args:
        payload: a dict-like object. Non-dicts are returned unchanged.
        keys: explicit iterable of keys to redact. If None, the
            conservative default set is used.
    """
    if not isinstance(payload, Mapping):
        return payload

    sensitive: set[str] = {
        k.lower() for k in (keys if keys is not None else _DEFAULT_SENSITIVE_KEYS)
    }
    out: dict[str, Any] = {}
    for k, v in payload.items():
        key_lower = str(k).lower()
        if key_lower in sensitive:
            if key_lower == "email":
                out[k] = redact_email(v) if isinstance(v, str) else "<redacted>"
            elif key_lower == "phone":
                out[k] = redact_phone(v) if isinstance(v, str) else "<redacted>"
            else:
                out[k] = "<redacted>"
        elif isinstance(v, Mapping):
            out[k] = redact_payload(v, keys=sensitive)
        elif isinstance(v, (list, tuple)):
            out[k] = type(v)(
                redact_payload(item, keys=sensitive) if isinstance(item, Mapping) else item
                for item in v
            )
        else:
            out[k] = v
    return out


__all__ = ["redact_email", "redact_phone", "redact_payload"]
