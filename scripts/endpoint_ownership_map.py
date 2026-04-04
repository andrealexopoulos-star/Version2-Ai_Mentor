#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
ROUTES_DIR = REPO_ROOT / "backend" / "routes"
REPORTS_DIR = REPO_ROOT / "test_reports"

ROUTER_PREFIX_RE = re.compile(r"APIRouter\((?P<body>.*?)\)", re.DOTALL)
PREFIX_VALUE_RE = re.compile(r"prefix\s*=\s*['\"]([^'\"]+)['\"]")
DECORATOR_RE = re.compile(r"^\s*@router\.(get|post|put|patch|delete)\(\s*['\"]([^'\"]+)['\"]")
DEF_RE = re.compile(r"^\s*(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(")


def latest_surface_audit() -> Path:
    files = sorted(
        REPORTS_DIR.glob("platform_surface_200_audit_*.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not files:
        raise FileNotFoundError("No platform_surface_200_audit_*.json found in test_reports/")
    return files[0]


def router_prefix(file_text: str) -> str:
    m = ROUTER_PREFIX_RE.search(file_text)
    if not m:
        return ""
    body = m.group("body")
    p = PREFIX_VALUE_RE.search(body)
    return p.group(1) if p else ""


def norm_api_path(path: str, prefix: str = "") -> str:
    raw = path if path.startswith("/") else f"/{path}"
    pfx = prefix if prefix.startswith("/") else f"/{prefix}" if prefix else ""
    merged = f"{pfx.rstrip('/')}{raw}" if pfx else raw
    merged = re.sub(r"//+", "/", merged)
    if not merged.startswith("/api/"):
        merged = f"/api{merged}"
    return merged


def template_to_regex(path_template: str) -> re.Pattern[str]:
    # Convert /api/cognition/{tab} into ^/api/cognition/[^/]+$
    escaped = re.escape(path_template)
    pattern = re.sub(r"\\\{[^\\\}]+\\\}", r"[^/]+", escaped)
    return re.compile(rf"^{pattern}$")


def parse_routes() -> List[Dict[str, str]]:
    entries: List[Dict[str, str]] = []
    for route_file in sorted(ROUTES_DIR.glob("*.py")):
        text = route_file.read_text(encoding="utf-8", errors="ignore")
        prefix = router_prefix(text)
        pending: List[Tuple[str, str]] = []
        for line in text.splitlines():
            dec = DECORATOR_RE.match(line)
            if dec:
                pending.append((dec.group(1).upper(), dec.group(2)))
                continue
            fn = DEF_RE.match(line)
            if fn and pending:
                fn_name = fn.group(1)
                for method, p in pending:
                    full = norm_api_path(p, prefix)
                    entries.append(
                        {
                            "method": method,
                            "path": full,
                            "path_template": full,
                            "file": str(route_file.relative_to(REPO_ROOT)),
                            "function": fn_name,
                        }
                    )
                pending = []
    return entries


def read_surface_endpoints(path: Path) -> List[Dict[str, str]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    seen = set()
    out: List[Dict[str, str]] = []
    for row in payload.get("results", []):
        endpoint = row.get("endpoint")
        method = (row.get("method") or "GET").upper()
        if not endpoint or endpoint == "NO_API_CALL_DETECTED":
            continue
        clean = endpoint.split("?", 1)[0]
        api_path = norm_api_path(clean)
        key = (method, api_path)
        if key in seen:
            continue
        seen.add(key)
        out.append({"method": method, "path": api_path, "surface_endpoint": clean})
    return out


def resolve_owner(endpoint: Dict[str, str], routes: List[Dict[str, str]]) -> Dict[str, str] | None:
    method = endpoint["method"]
    path = endpoint["path"]
    # Exact first.
    for r in routes:
        if r["method"] == method and r["path"] == path:
            return r
    # Template match.
    for r in routes:
        if r["method"] != method:
            continue
        if "{" in r["path_template"] and template_to_regex(r["path_template"]).match(path):
            return r
    return None


def main() -> int:
    audit = latest_surface_audit()
    endpoints = read_surface_endpoints(audit)
    routes = parse_routes()
    mapped = []
    unmapped = []
    for ep in endpoints:
        owner = resolve_owner(ep, routes)
        if owner:
            mapped.append({**ep, **owner})
        else:
            unmapped.append(ep)

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out = REPORTS_DIR / f"endpoint_ownership_map_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_surface_audit": str(audit.relative_to(REPO_ROOT)),
        "summary": {
            "endpoint_method_pairs": len(endpoints),
            "mapped": len(mapped),
            "unmapped": len(unmapped),
        },
        "mapped": mapped,
        "unmapped": unmapped,
    }
    out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "passed": len(unmapped) == 0,
                "artifact": str(out),
                "summary": result["summary"],
            },
            indent=2,
        )
    )
    return 0 if len(unmapped) == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
