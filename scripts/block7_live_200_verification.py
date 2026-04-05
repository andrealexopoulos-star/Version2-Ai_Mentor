#!/usr/bin/env python3
"""
Block 7 live verification mode.

Probes backend card/integration endpoints against live API surface with
documented contract exceptions (auth-required, templated paths, optional probes).
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple


REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "test_reports"
DEFAULT_BACKEND_BASE_URL = "https://biqc-api.azurewebsites.net"
TIMEOUT_SECONDS = 8
RETRY_TIMEOUT_SECONDS = 18
MAX_ENDPOINT_PROBES = 180
TRUTH_GATEWAY_PATHS = {
    "/api/intelligence/freshness",
    "/api/intelligence/summary",
}
TRUTH_GATEWAY_DEGRADED_ALLOWED = {"RPC_FUNCTION_MISSING", "SCHEMA_MISMATCH"}


def latest(prefix: str) -> Path | None:
    files = sorted(REPORTS_DIR.glob(f"{prefix}_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else None


def load_json(path: Path) -> Dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _parse_json_or_none(value: str) -> Dict | None:
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


def _is_number(value) -> bool:
    return isinstance(value, (int, float))


def _parse_bearer_token_candidate(raw: str | None) -> str:
    value = (raw or "").strip()
    if not value:
        return ""
    # Already a JWT-like bearer token.
    if value.count(".") == 2:
        return value
    # Accept JSON payloads copied directly from auth responses.
    if value.startswith("{") and value.endswith("}"):
        try:
            parsed = json.loads(value)
            token = str(parsed.get("access_token") or "").strip()
            if token.count(".") == 2:
                return token
        except Exception:
            return ""
    return ""


def _load_auth_bearer_token() -> Tuple[str | None, str]:
    direct = _parse_bearer_token_candidate(os.environ.get("AUTH_BEARER_TOKEN"))
    if direct:
        return direct, "AUTH_BEARER_TOKEN"

    inline_json = _parse_bearer_token_candidate(os.environ.get("AUTH_BEARER_TOKEN_JSON"))
    if inline_json:
        return inline_json, "AUTH_BEARER_TOKEN_JSON"

    token_file = (os.environ.get("AUTH_BEARER_TOKEN_FILE") or "").strip()
    if token_file:
        try:
            raw = Path(token_file).read_text(encoding="utf-8")
            file_token = _parse_bearer_token_candidate(raw)
            if file_token:
                return file_token, "AUTH_BEARER_TOKEN_FILE"
        except Exception:
            pass

    return None, "none"


def _evaluate_truth_gateway_contract(status: int, body: str) -> Tuple[str, str]:
    payload = _parse_json_or_none(body or "")
    if not payload:
        return "fail", "truth_gateway_payload_not_json"

    required_fields = (
        "status",
        "truth_level",
        "completeness",
        "confidence",
        "trace_id",
        "latency_ms",
        "degradation_flag",
    )
    missing_fields = [f for f in required_fields if f not in payload]
    if missing_fields:
        return "fail", f"truth_gateway_missing_fields:{','.join(missing_fields)}"

    if not _is_number(payload.get("completeness")) or not _is_number(payload.get("confidence")):
        return "fail", "truth_gateway_invalid_numeric_fields"

    if status == 200:
        if (
            payload.get("status") == "canonical"
            and payload.get("truth_level") == "verified"
            and payload.get("completeness") == 1.0
            and payload.get("confidence") == 1.0
            and payload.get("degradation_flag") is False
        ):
            return "pass", "truth_gateway_canonical"
        return "fail", "truth_gateway_canonical_contract_violation"

    if status == 424:
        if payload.get("status") != "degraded" or payload.get("truth_level") != "bounded":
            return "fail", "truth_gateway_degraded_shape_invalid"
        if payload.get("degradation_flag") is not True:
            return "fail", "truth_gateway_degraded_flag_invalid"
        if not isinstance(payload.get("missing_components"), list) or not isinstance(payload.get("broken_dependencies"), list):
            return "fail", "truth_gateway_degraded_visibility_missing"
        error_class = str(payload.get("error_class") or "")
        if error_class not in TRUTH_GATEWAY_DEGRADED_ALLOWED:
            return "fail", "truth_gateway_degraded_error_class_invalid"
        completeness = float(payload.get("completeness"))
        confidence = float(payload.get("confidence"))
        if completeness < 0.0 or completeness > 1.0:
            return "fail", "truth_gateway_completeness_out_of_range"
        if confidence != completeness:
            return "fail", "truth_gateway_confidence_mismatch"
        return "pass", "truth_gateway_bounded_degraded"

    if status == 503:
        if payload.get("status") == "failed" and payload.get("truth_level") == "unknown":
            return "fail", "truth_gateway_failed_unknown"
        return "fail", "truth_gateway_failed_malformed"

    return "fail", f"truth_gateway_unexpected_http_{status}"


def http_probe(url: str, token: str | None = None) -> Tuple[int, str]:
    def _single_probe(timeout_seconds: int) -> Tuple[int, str]:
        req = urllib.request.Request(url=url, method="GET")
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
                body = (resp.read() or b"").decode("utf-8", errors="ignore")[:4000]
                return int(resp.status), body
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = (e.read() or b"").decode("utf-8", errors="ignore")[:4000]
            except Exception:
                body = ""
            return int(e.code), body
        except Exception as e:  # noqa: BLE001
            return 0, str(e)[:200]

    status, detail = _single_probe(TIMEOUT_SECONDS)
    if status != 0:
        return status, detail
    if "timed out" in detail.lower():
        return _single_probe(RETRY_TIMEOUT_SECONDS)
    return status, detail


def main() -> int:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)

    zd_path = latest("zd_zr_za_manager")
    if not zd_path:
        out = REPORTS_DIR / f"block7_live_200_verification_{now.strftime('%Y%m%d_%H%M%S')}.json"
        payload = {"generated_at": now.isoformat(), "passed": False, "failure_codes": ["MISSING_ZDZRZA_ARTIFACT"]}
        out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(json.dumps({"passed": False, "artifact": str(out), "failure_codes": ["MISSING_ZDZRZA_ARTIFACT"]}, indent=2))
        return 1

    zd = load_json(zd_path)
    backend = os.environ.get("BACKEND_BASE_URL", DEFAULT_BACKEND_BASE_URL).rstrip("/")
    token, token_source = _load_auth_bearer_token()

    matrix = (zd.get("contract_matrix") or {}).get("backend_endpoints", [])
    probes = []
    # Seed public probes to guarantee strict 200 validation on always-on surfaces.
    public_seed_paths = ["/", "/docs", "/openapi.json", "/api/public/business-health"]
    for seed in public_seed_paths:
        status, detail = http_probe(f"{backend}{seed}", token=None)
        if status == 200:
            result = "pass"
            reason = ""
        elif status in {401, 403}:
            result = "contract_exception"
            reason = "public_probe_runtime_protected"
        elif status in {404, 405}:
            result = "contract_exception"
            reason = "public_probe_not_available"
        else:
            result = "fail"
            reason = detail or f"http_{status}"
        probes.append({
            "path": seed,
            "method": "GET",
            "status": status,
            "result": result,
            "reason": reason,
            "auth_required": False,
            "probe_group": "public_seed",
        })
    covered = 0
    truth_gateway_probe_count = 0
    truth_gateway_canonical_count = 0
    truth_gateway_degraded_count = 0
    truth_gateway_failed_count = 0
    for item in matrix:
        path = str(item.get("path") or "")
        method = str(item.get("method") or "GET").upper()
        auth_required = bool(item.get("auth_required"))
        if method != "GET":
            continue
        if "{" in path or "}" in path:
            probes.append({
                "path": path,
                "method": method,
                "status": None,
                "result": "contract_exception",
                "reason": "templated_path",
                "auth_required": auth_required,
            })
            continue
        if covered >= MAX_ENDPOINT_PROBES:
            break
        status, detail = http_probe(f"{backend}{path}", token=token)
        covered += 1
        if path in TRUTH_GATEWAY_PATHS:
            truth_gateway_probe_count += 1
            if status in {401, 403}:
                # Live truth-gateway endpoints are auth-protected. Without a valid
                # user fixture token this is a contract exception, not a gateway failure.
                result = "contract_exception"
                reason = "auth_required_without_valid_fixture"
            else:
                result, reason = _evaluate_truth_gateway_contract(status, detail)
                payload = _parse_json_or_none(detail or "") or {}
                truth_state = str(payload.get("status") or "").strip().lower()
                if result == "pass" and truth_state == "canonical":
                    truth_gateway_canonical_count += 1
                elif result == "pass" and truth_state == "degraded":
                    truth_gateway_degraded_count += 1
                elif truth_state == "failed" or status == 503:
                    truth_gateway_failed_count += 1
        else:
            if status == 200:
                result = "pass"
                reason = ""
            elif status in {401, 403}:
                result = "contract_exception"
                reason = "auth_required_without_valid_fixture"
            elif status == 422 and "/callback" in path:
                result = "contract_exception"
                reason = "callback_requires_query_params"
            elif status == 422 and "Field required" in detail:
                result = "contract_exception"
                reason = "query_params_required"
            elif status in {404, 405}:
                result = "contract_exception"
                reason = "non_probeable_get_surface"
            else:
                result = "fail"
                reason = detail or f"http_{status}"
        probes.append({
            "path": path,
            "method": method,
            "status": status,
            "result": result,
            "reason": reason,
            "auth_required": auth_required,
        })

    pass_count = sum(1 for p in probes if p["result"] == "pass")
    exception_count = sum(1 for p in probes if p["result"] == "contract_exception")
    fail_items = [p for p in probes if p["result"] == "fail"]
    auth_required_200_count = sum(
        1
        for p in probes
        if p.get("auth_required") and p.get("status") == 200
    )

    # strict pass: authenticated fixture required for full card/integration verification.
    passed = (
        bool(token)
        and (len(fail_items) == 0)
        and (pass_count > 0)
        and (auth_required_200_count > 0)
    )
    failure_codes: List[str] = []
    if fail_items:
        failure_codes.append("LIVE_ENDPOINT_PROBE_FAILURES")
    if any(p.get("path") in TRUTH_GATEWAY_PATHS and p.get("result") == "fail" for p in probes):
        failure_codes.append("TRUTH_GATEWAY_CONTRACT_FAILURES")
    if pass_count == 0:
        failure_codes.append("NO_LIVE_200_PROBES")
    if not token:
        failure_codes.append("MISSING_AUTH_FIXTURE_TOKEN")
    if token and auth_required_200_count == 0:
        failure_codes.append("INVALID_AUTH_FIXTURE_TOKEN")

    payload = {
        "generated_at": now.isoformat(),
        "passed": passed,
        "failure_codes": failure_codes,
        "backend_base_url": backend,
        "token_supplied": bool(token),
        "token_source": token_source,
        "auth_fixture_token_present": bool(token),
        "token_load_check_passed": bool(token),
        "live_200_verification_passed": passed,
        "summary": {
            "probes_total": len(probes),
            "probes_run": covered,
            "pass_200_count": pass_count,
            "auth_required_200_count": auth_required_200_count,
            "contract_exception_count": exception_count,
            "unexpected_fail_count": len(fail_items),
        },
        "truth_gateway_summary": {
            "probes": truth_gateway_probe_count,
            "canonical_count": truth_gateway_canonical_count,
            "bounded_degraded_count": truth_gateway_degraded_count,
            "failed_unknown_count": truth_gateway_failed_count,
        },
        "endpoints_checked": covered,
        "timestamp": now.isoformat(),
        "probes": probes,
        "source_artifact": str(zd_path.relative_to(REPO_ROOT)),
    }
    out = REPORTS_DIR / f"block7_live_200_verification_{now.strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"passed": passed, "artifact": str(out), "failure_codes": failure_codes}, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

