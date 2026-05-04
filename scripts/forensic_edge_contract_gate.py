#!/usr/bin/env python3
"""
Forensic edge-function contract gate for BIQc production.

Purpose:
- Probe all deployed edge function slugs with a controlled payload (`{}`).
- Enforce per-function contract as an allowed status-set, defaulting to:
  200 / 400 / 401 / 422
- Hard-fail if any function returns unexpected status (especially any 5xx).

Usage:
  python scripts/forensic_edge_contract_gate.py

Optional env:
  SUPABASE_PROJECT_REF   (default: vwwandhoydemcybltoxz)
  SUPABASE_BASE_URL      (default: https://<project-ref>.supabase.co/functions/v1)
  GATE_OUTPUT_PATH       (default: /tmp/forensic_edge_contract_gate_results.json)
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Set

import requests


PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "vwwandhoydemcybltoxz").strip()
BASE_URL = os.environ.get(
    "SUPABASE_BASE_URL", f"https://{PROJECT_REF}.supabase.co/functions/v1"
).rstrip("/")
OUTPUT_PATH = os.environ.get(
    "GATE_OUTPUT_PATH", "/tmp/forensic_edge_contract_gate_results.json"
).strip()

# Production deployed slugs discovered from Supabase project `vwwandhoydemcybltoxz`.
FUNCTION_SLUGS: List[str] = [
    "biqc-insights-cognitive",
    "biqc-trinity",
    "boardroom-diagnosis",
    "browse-ai-reviews",
    # P0 Marjo F14 (2026-05-04): customer-reviews-deep is the per-platform
    # Firecrawl/Serper deep-review extractor introduced by R2B; included in
    # the scan fanout, so it MUST be probed by the production contract gate.
    "customer-reviews-deep",
    "business-brain-merge-ingest",
    "business-brain-metrics-cron",
    "business-identity-lookup",
    "calibration-business-dna",
    "calibration-engine",
    "calibration-psych",
    "calibration-sync",
    "calibration_psych",
    "calibration-voice",
    "cfo-cash-analysis",
    "checkin-manager",
    "competitor-monitor",
    "deep-web-recon",
    "email_priority",
    "gmail_prod",
    "integration-status",
    "intelligence-bridge",
    "intelligence-snapshot",
    "market-analysis-ai",
    "market-signal-scorer",
    "merge-webhook-ingest",
    "outlook-auth",
    "outlook_auth",
    "query-integrations-data",
    "rapid-task",
    "refresh_tokens",
    "scrape-business-profile",
    "semrush-domain-intel",
    "signal-evaluator",
    "social-enrichment",
    # P0 Marjo F14 (2026-05-04): staff-reviews-deep is the per-platform
    # Firecrawl deep-employer-brand extractor introduced by R2C; same
    # rationale as customer-reviews-deep — must be on the contract gate.
    "staff-reviews-deep",
    "sop-generator",
    "strategic-console-ai",
    "warm-cognitive-engine",
    "watchtower-brain",
]

DEFAULT_ALLOWED = {200, 400, 401, 422}

# Per-function contract overrides can be tightened here over time.
ALLOWED_BY_FUNCTION: Dict[str, Set[int]] = {
    slug: set(DEFAULT_ALLOWED) for slug in FUNCTION_SLUGS
}


@dataclass
class ProbeResult:
    slug: str
    options_status: int
    post_status: int
    allowed: List[int]
    pass_contract: bool
    post_snippet: str


def _probe(slug: str) -> ProbeResult:
    opts = requests.options(
        f"{BASE_URL}/{slug}",
        headers={"Content-Type": "application/json"},
        timeout=20,
    )

    post = requests.post(
        f"{BASE_URL}/{slug}",
        headers={"Content-Type": "application/json"},
        json={},
        timeout=30,
    )

    allowed = sorted(ALLOWED_BY_FUNCTION.get(slug, DEFAULT_ALLOWED))
    ok = post.status_code in allowed
    snippet = (post.text or "")[:220].replace("\n", " ")
    return ProbeResult(
        slug=slug,
        options_status=opts.status_code,
        post_status=post.status_code,
        allowed=allowed,
        pass_contract=ok,
        post_snippet=snippet,
    )


def main() -> int:
    results: List[ProbeResult] = []
    for slug in FUNCTION_SLUGS:
        try:
            results.append(_probe(slug))
        except Exception as exc:
            results.append(
                ProbeResult(
                    slug=slug,
                    options_status=-1,
                    post_status=-1,
                    allowed=sorted(ALLOWED_BY_FUNCTION.get(slug, DEFAULT_ALLOWED)),
                    pass_contract=False,
                    post_snippet=f"probe_error: {type(exc).__name__}: {exc}",
                )
            )

    failed = [r for r in results if not r.pass_contract]
    severe = [r for r in results if r.post_status >= 500 or r.post_status == -1]

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "project_ref": PROJECT_REF,
        "base_url": BASE_URL,
        "total_functions": len(results),
        "passed": len(results) - len(failed),
        "failed": len(failed),
        "severe_failures": len(severe),
        "allowed_default": sorted(DEFAULT_ALLOWED),
        "results": [r.__dict__ for r in results],
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"Project: {PROJECT_REF}")
    print(f"Total: {payload['total_functions']}  Passed: {payload['passed']}  Failed: {payload['failed']}")
    for r in failed:
        print(
            f"FAIL {r.slug}: POST={r.post_status}, allowed={r.allowed}, "
            f"OPTIONS={r.options_status}, snippet={r.post_snippet}"
        )
    print(f"Saved report: {OUTPUT_PATH}")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
