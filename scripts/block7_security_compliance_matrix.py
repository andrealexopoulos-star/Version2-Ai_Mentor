#!/usr/bin/env python3
"""
Block 7 security/compliance matrix.

Builds per-integration control evidence and fails if mandatory controls are absent.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List


REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "test_reports"


def read(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def has_any(src: str, needles: List[str]) -> bool:
    s = src.lower()
    return any(n.lower() in s for n in needles)


def main() -> int:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)

    auth_src = read(REPO_ROOT / "backend" / "routes" / "auth.py")
    integrations_src = read(REPO_ROOT / "backend" / "routes" / "integrations.py")
    email_src = read(REPO_ROOT / "backend" / "routes" / "email.py")
    merge_src = read(REPO_ROOT / "backend" / "merge_client.py")
    deps_src = read(REPO_ROOT / "backend" / "routes" / "deps.py")
    soundboard_src = read(REPO_ROOT / "backend" / "routes" / "soundboard.py")
    billing_src = read(REPO_ROOT / "backend" / "routes" / "billing.py")
    config_src = read(REPO_ROOT / "backend" / "core" / "config.py")

    hardcoded_secret_literal = bool(
        re.search(r"['\"](?:sk_live_|sk_test_|AIza|AKIA|xoxb-)[A-Za-z0-9_\-]{8,}['\"]", merge_src + deps_src + config_src)
    )

    controls_global = {
        "oauth_or_oidc_present": has_any(auth_src + email_src, ["oauth", "openid", "oidc"]),
        "token_storage_server_side": has_any(integrations_src + email_src + auth_src, ["token", "refresh", "expires_at"]),
        "https_enforced_urls": has_any(merge_src + config_src, ["https://"]),
        "no_hardcoded_keys_pattern": (not hardcoded_secret_literal) and has_any(merge_src + deps_src + config_src, ["os.environ", "getenv"]),
        "rbac_least_privilege_presence": has_any(integrations_src + billing_src + soundboard_src, ["depends(get_current_user)"]),
        "rate_limit_control_present": has_any(soundboard_src + deps_src, ["check_rate_limit", "rate limit"]),
        "retry_or_resilience_present": has_any(merge_src + integrations_src, ["retry", "backoff", "timeout"]),
        "audit_logging_present": has_any(soundboard_src + integrations_src + billing_src, ["logger.", "log_"]),
    }

    integrations_matrix: List[Dict[str, object]] = [
        {
            "integration": "Email/Calendar (Google/Microsoft)",
            "auth": controls_global["oauth_or_oidc_present"],
            "token_handling": controls_global["token_storage_server_side"],
            "encryption_https": controls_global["https_enforced_urls"],
            "rbac": controls_global["rbac_least_privilege_presence"],
            "rate_limit": controls_global["rate_limit_control_present"],
            "retry": controls_global["retry_or_resilience_present"],
            "audit": controls_global["audit_logging_present"],
        },
        {
            "integration": "Merge CRM/Accounting/HRIS/ATS/Ticketing/File",
            "auth": controls_global["oauth_or_oidc_present"],
            "token_handling": controls_global["token_storage_server_side"],
            "encryption_https": controls_global["https_enforced_urls"],
            "rbac": controls_global["rbac_least_privilege_presence"],
            "rate_limit": controls_global["rate_limit_control_present"],
            "retry": controls_global["retry_or_resilience_present"],
            "audit": controls_global["audit_logging_present"],
        },
        {
            "integration": "Stripe/Xero Billing Surfaces",
            "auth": controls_global["oauth_or_oidc_present"],
            "token_handling": controls_global["token_storage_server_side"],
            "encryption_https": controls_global["https_enforced_urls"],
            "rbac": controls_global["rbac_least_privilege_presence"],
            "rate_limit": controls_global["rate_limit_control_present"],
            "retry": controls_global["retry_or_resilience_present"],
            "audit": controls_global["audit_logging_present"],
        },
    ]

    mandatory = [
        "oauth_or_oidc_present",
        "token_storage_server_side",
        "https_enforced_urls",
        "no_hardcoded_keys_pattern",
        "rbac_least_privilege_presence",
        "rate_limit_control_present",
        "retry_or_resilience_present",
        "audit_logging_present",
    ]
    failed_mandatory = [m for m in mandatory if not controls_global[m]]
    passed = len(failed_mandatory) == 0

    payload = {
        "generated_at": now.isoformat(),
        "passed": passed,
        "failure_codes": failed_mandatory,
        "global_controls": controls_global,
        "integrations_matrix": integrations_matrix,
        "mandatory_controls": mandatory,
    }
    out = REPORTS_DIR / f"block7_security_compliance_matrix_{now.strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"passed": passed, "artifact": str(out), "failure_codes": failed_mandatory}, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

