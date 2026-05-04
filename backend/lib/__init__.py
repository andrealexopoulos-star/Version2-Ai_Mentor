"""backend.lib — auxiliary helpers that supplement backend.core.

Contract v2 sanitiser bindings live in `contract_v2_sanitiser` per the
PR brief for fix/p0-marjo-e3-contract-v2-sanitiser. The canonical
implementation continues to live in `backend.core.response_sanitizer`
(established 2026-04-23 with PR #370). This package adds the
`sanitise_external_response(payload)` boundary helper + denylist-regex
guard required by the BIQc Platform Contract v2 mission spec.
"""
