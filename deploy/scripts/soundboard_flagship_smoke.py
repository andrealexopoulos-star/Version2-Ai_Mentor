#!/usr/bin/env python3
"""
Flagship Soundboard smoke checks (test/staging/local).

Usage:
  python deploy/scripts/soundboard_flagship_smoke.py

Environment variables:
  BACKEND_URL   (default: http://localhost:8001)
  AUTH_TOKEN    (required for authenticated checks)
  TIMEOUT_SEC   (optional, default: 45)
"""

import os
import sys
from typing import Any, Dict, Tuple

import requests


BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8001").rstrip("/")
AUTH_TOKEN = os.getenv("AUTH_TOKEN", "").strip()
TIMEOUT_SEC = int(os.getenv("TIMEOUT_SEC", "45"))


def check(name: str, ok: bool, detail: str) -> bool:
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}: {detail}")
    return ok


def _headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {AUTH_TOKEN}",
        "Content-Type": "application/json",
    }


def _safe_json(resp: requests.Response) -> Dict[str, Any]:
    try:
        data = resp.json()
        return data if isinstance(data, dict) else {"_raw": data}
    except Exception:
        return {}


def _validate_contract_payload(payload: Dict[str, Any]) -> Tuple[bool, str]:
    contract = payload.get("soundboard_contract")
    if not isinstance(contract, dict):
        return False, "missing soundboard_contract"
    required = ["version", "tier", "mode_requested", "mode_effective", "guardrail", "coverage_pct"]
    missing = [k for k in required if k not in contract]
    if missing:
        return False, f"missing contract keys: {', '.join(missing)}"
    return True, f"version={contract.get('version')}, mode={contract.get('mode_effective')}, guardrail={contract.get('guardrail')}"


def _validate_evidence_pack(payload: Dict[str, Any]) -> Tuple[bool, str]:
    pack = payload.get("evidence_pack")
    if not isinstance(pack, dict):
        return False, "missing evidence_pack"
    sources = pack.get("sources")
    source_count = pack.get("source_count")
    if not isinstance(sources, list):
        return False, "evidence_pack.sources must be list"
    if not isinstance(source_count, int):
        return False, "evidence_pack.source_count must be int"
    if source_count != len(sources):
        return False, f"source_count mismatch ({source_count} != {len(sources)})"
    return True, f"sources={len(sources)}"


def main() -> int:
    overall_ok = True

    if not AUTH_TOKEN:
        print("[FAIL] AUTH_TOKEN missing. Set AUTH_TOKEN to run Soundboard authenticated smoke checks.")
        return 1

    # 1) Health
    try:
        r = requests.get(f"{BACKEND_URL}/health", timeout=TIMEOUT_SEC)
        body = _safe_json(r)
        ok = r.status_code == 200 and body.get("status") in ("ok", "healthy")
        overall_ok &= check("Backend health", ok, f"status={r.status_code}, body_status={body.get('status')}")
    except Exception as exc:
        overall_ok &= check("Backend health", False, f"error={exc}")

    # 2) Conversations list
    try:
        r = requests.get(f"{BACKEND_URL}/api/soundboard/conversations", headers=_headers(), timeout=TIMEOUT_SEC)
        data = _safe_json(r)
        ok = r.status_code == 200 and isinstance(data.get("conversations"), list)
        overall_ok &= check("Conversations endpoint", ok, f"status={r.status_code}")
    except Exception as exc:
        overall_ok &= check("Conversations endpoint", False, f"error={exc}")

    # 3) Auto mode chat contract
    auto_payload = {
        "message": "Give me one strategic priority for this week based on my current business context.",
        "mode": "auto",
        "agent_id": "auto",
        "intelligence_context": {"request_scope": {"mailbox_scope": {"inbox": False, "sent": False, "deleted": False}}},
    }
    auto_resp = {}
    try:
        r = requests.post(f"{BACKEND_URL}/api/soundboard/chat", headers=_headers(), json=auto_payload, timeout=TIMEOUT_SEC)
        auto_resp = _safe_json(r)
        ok = r.status_code == 200 and isinstance(auto_resp.get("reply"), str) and bool(auto_resp.get("reply", "").strip())
        overall_ok &= check("Auto chat reply", ok, f"status={r.status_code}")
    except Exception as exc:
        overall_ok &= check("Auto chat reply", False, f"error={exc}")

    if auto_resp:
        ok, detail = _validate_contract_payload(auto_resp)
        overall_ok &= check("Auto chat contract payload", ok, detail)

        ok, detail = _validate_evidence_pack(auto_resp)
        overall_ok &= check("Auto chat evidence pack", ok, detail)

        suggested = auto_resp.get("suggested_actions", [])
        has_action_contract = all(
            isinstance(item, dict) and "label" in item and "action" in item and "prompt" in item
            for item in suggested
        ) if isinstance(suggested, list) else False
        overall_ok &= check(
            "Suggested actions contract",
            isinstance(suggested, list) and (has_action_contract or len(suggested) == 0),
            f"count={len(suggested) if isinstance(suggested, list) else 'n/a'}",
        )

    # 4) Boardroom orchestration trace
    boardroom_payload = {
        "message": "As boardroom, challenge our growth assumptions and give a consensus this-week execution move.",
        "mode": "normal",
        "agent_id": "boardroom",
    }
    boardroom_resp = {}
    try:
        r = requests.post(f"{BACKEND_URL}/api/soundboard/chat", headers=_headers(), json=boardroom_payload, timeout=TIMEOUT_SEC)
        boardroom_resp = _safe_json(r)
        ok = r.status_code == 200 and isinstance(boardroom_resp.get("reply"), str)
        overall_ok &= check("Boardroom chat reply", ok, f"status={r.status_code}")
    except Exception as exc:
        overall_ok &= check("Boardroom chat reply", False, f"error={exc}")

    if boardroom_resp:
        trace = boardroom_resp.get("boardroom_trace")
        has_trace = isinstance(trace, dict) and isinstance(trace.get("phases"), list) and len(trace.get("phases")) > 0
        overall_ok &= check("Boardroom trace phases", has_trace, f"trace_phases={len(trace.get('phases', [])) if isinstance(trace, dict) else 0}")

    # 5) Trinity request behavior (effective mode always returned)
    trinity_payload = {
        "message": "Run trinity reasoning and provide one decisive move for this week.",
        "mode": "trinity",
        "agent_id": "auto",
    }
    try:
        r = requests.post(f"{BACKEND_URL}/api/soundboard/chat", headers=_headers(), json=trinity_payload, timeout=TIMEOUT_SEC)
        data = _safe_json(r)
        ok = r.status_code == 200 and isinstance(data.get("mode_effective"), str)
        overall_ok &= check("Trinity effective mode returned", ok, f"status={r.status_code}, mode_effective={data.get('mode_effective')}")
    except Exception as exc:
        overall_ok &= check("Trinity effective mode returned", False, f"error={exc}")

    return 0 if overall_ok else 1


if __name__ == "__main__":
    sys.exit(main())
