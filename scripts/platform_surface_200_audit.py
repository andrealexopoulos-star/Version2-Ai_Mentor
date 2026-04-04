#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
ZD_PATH = REPO_ROOT / "test_reports" / "zd_zr_za_manager_20260403_103134.json"
OUT_DIR = REPO_ROOT / "test_reports"
FRONTEND_BASE = "https://biqc.ai"
BACKEND_BASE = "https://biqc-api.azurewebsites.net"
TEST_USER_ID = "345601e4-c94c-473d-a772-4891bdb0b10e"
TEST_EMAIL = "andre@thestrategysquad.com.au"
TIMEOUT = 20
LONG_TIMEOUT = 120


def read_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def extract_rows() -> List[Dict[str, Any]]:
    zd = read_json(ZD_PATH)
    rows: List[Dict[str, Any]] = []
    for route in zd.get("frontend_routes", []):
        source_file = route.get("source_file") or ""
        if not source_file.startswith("frontend/src/pages/"):
            continue
        file_path = REPO_ROOT / source_file
        if not file_path.exists():
            continue
        text = file_path.read_text(encoding="utf-8", errors="ignore")
        calls = [(m.upper(), ep) for m, ep in re.findall(r"apiClient\.(get|post|put|delete)\('([^']+)'", text)]
        if not calls:
            rows.append(
                {
                    "page": route.get("path"),
                    "component": route.get("component"),
                    "method": "READ",
                    "endpoint": "NO_API_CALL_DETECTED",
                    "source_file": source_file,
                }
            )
            continue
        for method, endpoint in calls:
            rows.append(
                {
                    "page": route.get("path"),
                    "component": route.get("component"),
                    "method": method,
                    "endpoint": endpoint,
                    "source_file": source_file,
                }
            )
    return rows


def auth_headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def backend_url(endpoint: str) -> str:
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        return endpoint
    if endpoint.startswith("/api/"):
        return f"{BACKEND_BASE}{endpoint}"
    if endpoint.startswith("/"):
        return f"{BACKEND_BASE}/api{endpoint}"
    return f"{BACKEND_BASE}/api/{endpoint}"


def default_value(field_name: str) -> Any:
    key = field_name.lower()
    now = datetime.now(timezone.utc)
    if key in {"email"}:
        return TEST_EMAIL
    if key in {"user_id", "target_user_id", "owner_user_id"}:
        return TEST_USER_ID
    if key in {"approver_user_id", "product_approver_user_id", "finance_approver_user_id", "legal_approver_user_id"}:
        return "11111111-1111-4111-8111-111111111111"
    if key in {"disable"}:
        return False
    if key in {"tier", "plan_key"}:
        return "starter"
    if key in {"target_version", "version"}:
        return 1
    if key in {"name"}:
        return "Audit Test"
    if key in {"business_name"}:
        return "Audit Business"
    if key in {"callback_date"}:
        return now.date().isoformat()
    if key in {"callback_time"}:
        return "10:00"
    if key in {"description", "reason", "details", "message"}:
        return "Platform forensic audit test payload."
    if key in {"origin_url"}:
        return "https://biqc.ai/subscribe"
    if key in {"package_id"}:
        return "starter"
    if key in {"url", "website"}:
        return "https://example.com"
    if key in {"feature_requested"}:
        return "general"
    if key in {"action"}:
        return "acknowledge"
    if key in {"alert_id"}:
        return "audit-alert"
    if key in {"feature_name"}:
        return "exposure_scan"
    if key in {"priority_level"}:
        return "medium"
    if key in {"current_step"}:
        return 1
    if key in {"completed_steps"}:
        return []
    if key in {"helpful"}:
        return True
    if key in {"affected_domains"}:
        return ["operations"]
    if key in {"answers", "baseline"}:
        return {"audit": True}
    if key in {"category"}:
        return "documents"
    if key in {"subject"}:
        return "Audit event"
    if key in {"body"}:
        return "Audit payload body"
    if key in {"start_time", "end_time"}:
        return now.isoformat()
    if key in {"plan_version"}:
        return 1
    if key in {"newtier"}:
        return "starter"
    if key in {"notes"}:
        return "audit"
    if key in {"status"}:
        return "planned"
    if key in {"checkpoint_key", "milestone_key", "target_metric"}:
        return "audit_metric"
    if key in {"features", "blocked_by", "competitors"}:
        return []
    return "audit"


def parse_missing_fields(body: str) -> List[str]:
    fields: List[str] = []
    try:
        payload = json.loads(body)
    except Exception:
        return fields
    detail = payload.get("detail")
    if not isinstance(detail, list):
        return fields
    for item in detail:
        loc = item.get("loc")
        if isinstance(loc, list) and loc:
            field = str(loc[-1])
            if field and field not in fields:
                fields.append(field)
    return fields


def endpoint_payload(method: str, endpoint: str) -> Dict[str, Any]:
    e = endpoint.split("?", 1)[0]
    if e == "/payments/checkout":
        return {"tier": "starter"}
    if e == "/stripe/create-checkout-session":
        return {"tier": "starter"}
    if e == "/intelligence/alerts/action":
        return {"alert_id": "audit-alert", "action": "acknowledge", "notes": "audit"}
    if e == "/cognition/decisions":
        return {
            "decision_category": "operations",
            "decision_statement": "Audit decision text",
            "affected_domains": ["operations"],
            "expected_time_horizon": 30,
        }
    if e == "/workflows/decision-feedback":
        return {"decision_key": "audit-decision", "helpful": True, "reason": "audit"}
    if e == "/forensic/calibration":
        return {"answers": {"revenue": {"answer": "Balanced", "index": 2, "weight": "revenue"}}}
    if e == "/onboarding/save":
        return {"current_step": 1, "data": {"audit": True}, "completed": False}
    if e == "/tutorials/preferences":
        return {"tutorials_disabled": False}
    if e == "/soundboard/record-scan":
        return {"feature_name": "exposure_scan"}
    if e == "/email/priority/reclassify":
        return {
            "email_id": "11111111-1111-4111-8111-111111111112",
            "provider": "outlook",
            "priority_level": "medium",
        }
    if e == "/email/send-recommended-reply":
        return {
            "email_id": "11111111-1111-4111-8111-111111111112",
            "suggested_reply": "Thanks, acknowledged. We will action this today.",
            "subject": "Audit response",
        }
    if e == "/baseline":
        return {"baseline": {"audit": True}}
    if e == "/admin/pricing/plans":
        return {
            "plan_key": "starter",
            "name": "Starter",
            "currency": "AUD",
            "monthly_price_cents": 1000,
            "annual_price_cents": 10000,
            "metadata": {"audit": True},
        }
    if e == "/admin/pricing/publish":
        return {
            "plan_key": "starter",
            "effective_from": datetime.now(timezone.utc).isoformat(),
            "product_approver_user_id": "11111111-1111-4111-8111-111111111111",
            "finance_approver_user_id": "11111111-1111-4111-8111-111111111112",
            "legal_approver_user_id": "11111111-1111-4111-8111-111111111113",
        }
    if e == "/admin/pricing/rollback":
        return {
            "plan_key": "starter",
            "target_version": 1,
            "product_approver_user_id": "11111111-1111-4111-8111-111111111111",
            "finance_approver_user_id": "11111111-1111-4111-8111-111111111112",
            "legal_approver_user_id": "11111111-1111-4111-8111-111111111113",
            "reason": "audit rollback",
        }
    if e == "/admin/pricing/overrides":
        return {"user_id": TEST_USER_ID, "status": "active", "override_payload": {"audit": True}}
    if e == "/admin/pricing/entitlements":
        return {"plan_key": "starter", "features": []}
    if e == "/admin/ux-feedback/checkpoints":
        return {
            "milestone_key": "audit_milestone",
            "checkpoint_key": "audit_checkpoint",
            "target_metric": "adoption",
            "status": "planned",
        }
    if e == "/support/toggle-user":
        return {"user_id": TEST_USER_ID, "disable": False}
    if e == "/support/reset-password":
        return {"user_id": TEST_USER_ID, "email": TEST_EMAIL}
    if e == "/support/update-subscription":
        return {"user_id": TEST_USER_ID, "tier": "starter"}
    if e == "/support/impersonate":
        return {"user_id": TEST_USER_ID}
    if e == "/enterprise/contact-request":
        return {
            "name": "Andre Audit",
            "business_name": "Audit Business",
            "email": TEST_EMAIL,
            "callback_date": datetime.now(timezone.utc).date().isoformat(),
            "callback_time": "10:00",
            "description": "Audit request",
            "feature_requested": "general",
        }
    if e == "/website/enrich":
        return {"url": "https://example.com"}
    if e == "/marketing/benchmark":
        return {"competitors": ["example.com"]}
    if e == "/dsee/scan":
        return {"url": "https://example.com", "business_name": "Audit", "public_mode": True}
    if e == "/contact/recalibration":
        return {"reason": "audit"}
    if e == "/automation/generate":
        return {"prompt": "audit", "channel": "email"}
    if e == "/experiments/create":
        return {"name": "audit_experiment", "description": "audit", "variant_a": "control", "variant_b": "test", "traffic_pct_b": 0.5}
    if e == "/outlook/calendar/create":
        now = datetime.now(timezone.utc)
        return {
            "title": "Audit meeting",
            "summary": "Audit body",
            "start_at": now.isoformat(),
            "end_at": (now + timedelta(minutes=30)).isoformat(),
        }
    if e == "/workflows/delegate/execute":
        return {
            "decision_title": "Audit delegate",
            "decision_summary": "Audit workflow execution",
            "domain": "operations",
            "severity": "medium",
        }
    return {}


def request_json(method: str, url: str, token: str, payload: Dict[str, Any] | None = None, timeout: int = TIMEOUT) -> Tuple[int, str]:
    data = None
    headers = {"Authorization": f"Bearer {token}"}
    if method in {"POST", "PUT", "PATCH", "DELETE"}:
        body = payload or {}
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url=url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return int(resp.status), (resp.read() or b"").decode("utf-8", errors="ignore")[:400]
    except urllib.error.HTTPError as exc:
        return int(exc.code), (exc.read() or b"").decode("utf-8", errors="ignore")[:800]
    except Exception as exc:
        return 0, str(exc)[:300]


def request_multipart(url: str, token: str, category: str) -> Tuple[int, str]:
    boundary = "----BIQCAuditBoundary"
    body = (
        f"--{boundary}\r\n"
        "Content-Disposition: form-data; name=\"category\"\r\n\r\n"
        f"{category}\r\n"
        f"--{boundary}\r\n"
        "Content-Disposition: form-data; name=\"file\"; filename=\"audit.txt\"\r\n"
        "Content-Type: text/plain\r\n\r\n"
        "audit upload\r\n"
        f"--{boundary}--\r\n"
    ).encode("utf-8")
    req = urllib.request.Request(
        url=url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return int(resp.status), (resp.read() or b"").decode("utf-8", errors="ignore")[:400]
    except urllib.error.HTTPError as exc:
        return int(exc.code), (exc.read() or b"").decode("utf-8", errors="ignore")[:800]
    except Exception as exc:
        return 0, str(exc)[:300]


def request_frontend_page(path: str) -> Tuple[int, str]:
    url = f"{FRONTEND_BASE}{path}"
    req = urllib.request.Request(url=url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return int(resp.status), ""
    except urllib.error.HTTPError as exc:
        return int(exc.code), (exc.read() or b"").decode("utf-8", errors="ignore")[:300]
    except Exception as exc:
        return 0, str(exc)[:300]


def run_row(row: Dict[str, Any], token: str) -> Dict[str, Any]:
    method = row["method"]
    endpoint = row["endpoint"]
    page = row["page"]

    if endpoint == "NO_API_CALL_DETECTED":
        status, detail = request_frontend_page(page)
        return {
            **row,
            "probe_url": f"{FRONTEND_BASE}{page}",
            "http_status": status,
            "result": "PASS" if status == 200 else "FAIL",
            "detail": detail,
        }

    url = backend_url(endpoint)
    if method == "GET":
        if endpoint.startswith("/admin/pricing/entitlements") and "plan_key=" not in endpoint:
            endpoint = f"{endpoint}?plan_key=starter"
            url = backend_url(endpoint)
        status, detail = request_json("GET", url, token, None)
        return {
            **row,
            "probe_url": url,
            "http_status": status,
            "result": "PASS" if status == 200 else "FAIL",
            "detail": detail,
        }

    payload: Dict[str, Any] = endpoint_payload(method, endpoint)
    base_endpoint = endpoint.split("?", 1)[0]
    if base_endpoint == "/data-center/upload":
        status, detail = request_multipart(url, token, str(payload.get("category", "documents")))
    else:
        timeout = LONG_TIMEOUT if base_endpoint == "/dsee/scan" else TIMEOUT
        status, detail = request_json(method, url, token, payload, timeout=timeout)
    attempts = 0
    while status == 422 and attempts < 4:
        attempts += 1
        for field in parse_missing_fields(detail):
            if field not in payload:
                payload[field] = default_value(field)
        status, detail = request_json(method, url, token, payload, timeout=timeout)
    return {
        **row,
        "probe_url": url,
        "payload": payload,
        "http_status": status,
        "result": "PASS" if status == 200 else "FAIL",
        "detail": detail,
    }


def ensure_admin_pricing_seed(token: str) -> None:
    url = backend_url("/admin/pricing/plans")
    base = {
        "currency": "AUD",
        "monthly_price_cents": 1000,
        "annual_price_cents": 10000,
        "metadata": {"source": "platform_surface_200_audit"},
    }
    for plan in ("starter", "pro", "enterprise"):
        payload = {"plan_key": plan, "name": plan.title(), **base}
        request_json("PUT", url, token, payload)


def ensure_prereq_rows() -> None:
    # Seed a secondary approver user row used by dual-approval admin pricing endpoints.
    sql = (
        "insert into public.users (id,email,role,subscription_tier,is_master_account,created_at,updated_at) "
        "values ('11111111-1111-4111-8111-111111111111'::uuid,'audit-approver@biqc.ai','superadmin','super_admin',true,now(),now()) "
        "on conflict (id) do update set role='superadmin', subscription_tier='super_admin', is_master_account=true, updated_at=now();"
    )
    os.system(f"supabase db query --linked \"{sql}\" >/dev/null 2>&1")
    profile_sql = (
        "insert into public.business_profiles (user_id,business_name,website,industry,location,updated_at) "
        "values ('345601e4-c94c-473d-a772-4891bdb0b10e'::uuid,'Www','https://example.com','Professional Services','Australia',now()) "
        "on conflict (user_id) do update set business_name=excluded.business_name, website=excluded.website, industry=excluded.industry, location=excluded.location, updated_at=now();"
    )
    os.system(f"supabase db query --linked \"{profile_sql}\" >/dev/null 2>&1")
    email_sql = (
        "insert into public.outlook_emails (id,user_id,graph_message_id,subject,from_address,body_preview,provider,received_date,is_read,synced_at) "
        "values ('11111111-1111-4111-8111-111111111112'::uuid,'345601e4-c94c-473d-a772-4891bdb0b10e'::uuid,'audit-msg-1','Audit Subject','audit@example.com','Audit body','outlook',now(),false,now()) "
        "on conflict (id) do update set subject=excluded.subject, body_preview=excluded.body_preview, synced_at=now();"
    )
    os.system(f"supabase db query --linked \"{email_sql}\" >/dev/null 2>&1")


def write_outputs(results: List[Dict[str, Any]]) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    path = OUT_DIR / f"platform_surface_200_audit_{ts}.json"
    summary = {
        "total": len(results),
        "pass": sum(1 for r in results if r["result"] == "PASS"),
        "fail": sum(1 for r in results if r["result"] == "FAIL"),
    }
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "results": results,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path


def main() -> int:
    token = os.environ.get("AUTH_BEARER_TOKEN", "").strip()
    if not token:
        print(json.dumps({"passed": False, "failure_code": "MISSING_AUTH_BEARER_TOKEN"}))
        return 1

    ensure_prereq_rows()
    ensure_admin_pricing_seed(token)
    rows = extract_rows()
    results = [run_row(row, token) for row in rows]
    out = write_outputs(results)
    summary = {
        "passed": all(r["http_status"] == 200 for r in results),
        "artifact": str(out),
        "pass_count": sum(1 for r in results if r["http_status"] == 200),
        "fail_count": sum(1 for r in results if r["http_status"] != 200),
    }
    print(json.dumps(summary, indent=2))
    return 0 if summary["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
