#!/usr/bin/env python3
"""
Zero Drift / Zero Regression / Zero Assumption Manager (ZD-ZR-ZA).

This script creates auditable release evidence by inventorying key platform
surfaces and verifying baseline governance controls are present.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Sequence, Tuple


REPO_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = REPO_ROOT / "frontend" / "src"
BACKEND_ROUTES_DIR = REPO_ROOT / "backend" / "routes"
EDGE_FUNCTIONS_DIR = REPO_ROOT / "supabase" / "functions"
DEPLOY_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "deploy.yml"
OUTPUT_DIR = REPO_ROOT / "test_reports"

DEFAULT_VENDOR_TERMS = ("merge", "supabase")
UI_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx"}


@dataclass
class RouteRecord:
    path: str
    component: str
    source_file: str


@dataclass
class BackendEndpoint:
    file: str
    method: str
    path: str
    function_name: str


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""


def parse_frontend_routes() -> List[RouteRecord]:
    app_file = FRONTEND_DIR / "App.js"
    src = read_text(app_file)
    if not src:
        return []

    pattern = re.compile(
        r"<Route\s+path=\"([^\"]+)\"[^>]*element=\{<([A-Za-z0-9_]+)",
        re.MULTILINE,
    )
    routes: List[RouteRecord] = []
    for match in pattern.finditer(src):
        routes.append(
            RouteRecord(
                path=match.group(1).strip(),
                component=match.group(2).strip(),
                source_file=str(app_file.relative_to(REPO_ROOT)),
            )
        )
    return routes


def parse_backend_endpoints() -> List[BackendEndpoint]:
    dec_re = re.compile(r"@router\.(get|post|put|patch|delete)\(\"([^\"]+)\"")
    fn_re = re.compile(r"def\s+([A-Za-z0-9_]+)\s*\(")
    out: List[BackendEndpoint] = []

    for file in sorted(BACKEND_ROUTES_DIR.glob("*.py")):
        src = read_text(file)
        if not src:
            continue
        lines = src.splitlines()
        for idx, line in enumerate(lines):
            dmatch = dec_re.search(line)
            if not dmatch:
                continue

            method = dmatch.group(1).upper()
            route_path = dmatch.group(2)
            function_name = "unknown"
            for j in range(idx + 1, min(idx + 30, len(lines))):
                fmatch = fn_re.search(lines[j])
                if fmatch:
                    function_name = fmatch.group(1)
                    break

            out.append(
                BackendEndpoint(
                    file=str(file.relative_to(REPO_ROOT)),
                    method=method,
                    path=f"/api{route_path}",
                    function_name=function_name,
                )
            )
    return out


def list_edge_functions() -> List[str]:
    if not EDGE_FUNCTIONS_DIR.exists():
        return []
    return sorted(
        d.name
        for d in EDGE_FUNCTIONS_DIR.iterdir()
        if d.is_dir() and (d / "index.ts").exists()
    )


def scan_vendor_leaks(
    frontend_dir: Path,
    terms: Sequence[str],
) -> Dict[str, List[Dict[str, object]]]:
    findings: Dict[str, List[Dict[str, object]]] = {t: [] for t in terms}

    # Known technical paths where terms may appear legitimately.
    allowlisted = {
        "frontend/src/pages/LoginSupabase.js",
        "frontend/src/pages/RegisterSupabase.js",
        "frontend/src/context/SupabaseAuthContext.js",
        "frontend/src/hooks/useIntegrationStatus.js",
    }

    lowered = [t.lower() for t in terms]
    for file in sorted(frontend_dir.rglob("*")):
        if not file.is_file() or file.suffix not in UI_EXTENSIONS:
            continue
        rel = str(file.relative_to(REPO_ROOT))
        if rel in allowlisted:
            continue
        src = read_text(file)
        if not src:
            continue

        for line_no, raw in enumerate(src.splitlines(), start=1):
            line = raw.strip()
            line_l = line.lower()
            for term_l, term in zip(lowered, terms):
                if term_l in line_l:
                    findings[term].append(
                        {"file": rel, "line": line_no, "snippet": line[:220]}
                    )
    return findings


def classify_visible_vendor_hits(
    findings: Dict[str, List[Dict[str, object]]],
) -> Dict[str, List[Dict[str, object]]]:
    """
    Heuristic classifier:
    - visible: likely user-facing copy/text literal.
    - technical: code-level references (imports, URLs, env vars, symbols).
    """
    out: Dict[str, List[Dict[str, object]]] = {}
    technical_signals = (
        "import ",
        " from ",
        "http://",
        "https://",
        "supabase.",
        "supabase_",
        "merge_",
        "merge.",
        "re_app_",
        "process.env",
        "useSupabase",
        "LoginSupabase",
        "RegisterSupabase",
        "linktoken",
        "mergelink",
        "mergecategories",
        "mergeconnected",
        "mergeres",
        "mergeMap",
        "twmerge",
        "/integrations/merge/",
        "/login-supabase",
        "/register-supabase",
        "data-testid=",
        "className=",
        "const ",
        "let ",
        "var ",
        "=>",
        "fetch(",
        "apiclient.",
        "window.location",
    )

    for term, items in findings.items():
        picked: List[Dict[str, object]] = []
        for item in items:
            snippet = str(item.get("snippet", ""))
            lower = snippet.lower()
            if any(sig in lower for sig in technical_signals):
                continue
            if lower.startswith("//") or lower.startswith("/*") or lower.startswith("* "):
                continue
            if re.search(r"[=:{[(].*\b(merge|supabase)\b", lower):
                continue
            # Distinguish vendor name from programming verb "merge".
            if term == "merge":
                looks_like_vendor = bool(
                    re.search(r"\bmerge\.dev\b", lower)
                    or re.search(r"\b@mergeapi\b", lower)
                    or re.search(r"\bvia merge\b", lower)
                    or re.search(r"\bmerge connector\b", lower)
                    or re.search(r"\bmerge ticketing\b", lower)
                    or re.search(r"\bmerge\b", snippet)
                )
                if not looks_like_vendor:
                    continue

            # Only include literal text likely rendered for users.
            has_literal = ('"' in snippet or "'" in snippet or "`" in snippet)
            looks_like_ui_copy = bool(
                re.search(r">\s*[^<]*(merge|supabase)[^<]*<", snippet, flags=re.IGNORECASE)
                or re.search(r"(label|title|subtitle|description|desc|placeholder)\s*[:=]\s*['\"`].*(merge|supabase)", snippet, flags=re.IGNORECASE)
                or re.search(r"['\"`][^'\"`]*(merge|supabase)[^'\"`]*['\"`]", snippet, flags=re.IGNORECASE)
            )
            if has_literal and looks_like_ui_copy:
                picked.append(item)
        out[term] = picked
    return out


def analyze_deploy_workflow() -> Dict[str, object]:
    src = read_text(DEPLOY_WORKFLOW)
    if not src:
        return {
            "present": False,
            "forensic_gate_version": None,
            "website_change_gate": False,
            "preprod_forensic_gate": False,
            "critical_probe_functions": [],
        }

    version_match = re.search(r"FORENSIC_GATE_VERSION=([^\n\"']+)", src)
    probe_details = []
    probe_re = re.compile(
        r"check_status\s+\"([a-zA-Z0-9\-_]+)\"\s+\"([A-Z]+)\"\s+\"([^\"]*)\"\s+\"([0-9 ]+)\""
    )
    for match in probe_re.finditer(src):
        probe_details.append(
            {
                "function": match.group(1),
                "method": match.group(2),
                "allowed_statuses": [int(x) for x in match.group(4).split() if x.strip()],
            }
        )
    probes = sorted({p["function"] for p in probe_details})

    return {
        "present": True,
        "forensic_gate_version": version_match.group(1).strip() if version_match else None,
        "website_change_gate": "Website Change Gate" in src,
        "website_blocking_step": "Enforce approval for protected website changes" in src,
        "preprod_forensic_gate": "Pre-Prod Forensic Gate" in src,
        "critical_probe_functions": probes,
        "critical_probe_contracts": probe_details,
    }


def summarise(
    routes: Sequence[RouteRecord],
    endpoints: Sequence[BackendEndpoint],
    edge_functions: Sequence[str],
    vendor_findings: Dict[str, List[Dict[str, object]]],
    visible_vendor_findings: Dict[str, List[Dict[str, object]]],
    deploy_analysis: Dict[str, object],
) -> Dict[str, object]:
    vendor_count = sum(len(v) for v in vendor_findings.values())
    visible_vendor_count = sum(len(v) for v in visible_vendor_findings.values())
    return {
        "frontend_routes": len(routes),
        "backend_endpoints": len(endpoints),
        "edge_functions": len(edge_functions),
        "vendor_leak_hits": vendor_count,
        "likely_visible_vendor_leak_hits": visible_vendor_count,
        "vendor_terms_with_hits": sorted(k for k, v in vendor_findings.items() if v),
        "vendor_terms_with_likely_visible_hits": sorted(
            k for k, v in visible_vendor_findings.items() if v
        ),
        "forensic_gate_version": deploy_analysis.get("forensic_gate_version"),
        "website_change_gate_present": bool(deploy_analysis.get("website_change_gate")),
        "preprod_forensic_gate_present": bool(deploy_analysis.get("preprod_forensic_gate")),
    }


def main() -> int:
    output_env = os.environ.get("ZDZRZA_OUTPUT_PATH", "").strip()
    if output_env:
        output_path = Path(output_env)
    else:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        output_path = OUTPUT_DIR / f"zd_zr_za_manager_{stamp}.json"

    output_path.parent.mkdir(parents=True, exist_ok=True)

    routes = parse_frontend_routes()
    endpoints = parse_backend_endpoints()
    edge_functions = list_edge_functions()
    vendor_findings = scan_vendor_leaks(FRONTEND_DIR, DEFAULT_VENDOR_TERMS)
    visible_vendor_findings = classify_visible_vendor_hits(vendor_findings)
    deploy_analysis = analyze_deploy_workflow()

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repository": str(REPO_ROOT),
        "summary": summarise(
            routes,
            endpoints,
            edge_functions,
            vendor_findings,
            visible_vendor_findings,
            deploy_analysis,
        ),
        "frontend_routes": [asdict(r) for r in routes],
        "backend_endpoints": [asdict(e) for e in endpoints],
        "edge_functions": edge_functions,
        "vendor_branding_findings": vendor_findings,
        "vendor_branding_likely_visible_findings": visible_vendor_findings,
        "deploy_workflow_analysis": deploy_analysis,
        "contract_matrix": {
            "backend_endpoints": [
                {
                    "method": e.method,
                    "path": e.path,
                    "owner": "TO_ASSIGN",
                    "expected_status_policy": "TO_DEFINE",
                }
                for e in endpoints
            ],
            "edge_functions": [
                {
                    "function": fn,
                    "owner": "TO_ASSIGN",
                    "expected_status_policy": "TO_DEFINE",
                }
                for fn in edge_functions
            ],
            "critical_edge_probe_contracts": deploy_analysis.get("critical_probe_contracts", []),
        },
    }

    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"[zd-zr-za] Evidence written: {output_path}")
    print(json.dumps(payload["summary"], indent=2))

    # Structural blocking checks
    if not deploy_analysis.get("present"):
        return 2
    if not deploy_analysis.get("website_change_gate"):
        return 3
    if not deploy_analysis.get("preprod_forensic_gate"):
        return 4
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

