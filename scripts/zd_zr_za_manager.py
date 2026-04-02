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
from typing import Any, Dict, List, Sequence, Tuple


REPO_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = REPO_ROOT / "frontend" / "src"
BACKEND_ROUTES_DIR = REPO_ROOT / "backend" / "routes"
EDGE_FUNCTIONS_DIR = REPO_ROOT / "supabase" / "functions"
DEPLOY_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "deploy.yml"
OUTPUT_DIR = REPO_ROOT / "test_reports"
APP_FILE = FRONTEND_DIR / "App.js"

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
    auth_required: bool


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""


def parse_frontend_routes() -> List[RouteRecord]:
    lineage = parse_frontend_route_lineage()
    return [
        RouteRecord(
            path=item["path"],
            component=item["leaf_component"],
            source_file=item["leaf_source_file"],
        )
        for item in lineage
    ]


def resolve_import_target(base_file: Path, raw_target: str) -> Path | None:
    if not raw_target.startswith("."):
        return None
    base = (base_file.parent / raw_target).resolve()
    candidates = [
        base,
        base.with_suffix(".js"),
        base.with_suffix(".jsx"),
        base.with_suffix(".ts"),
        base.with_suffix(".tsx"),
        base / "index.js",
        base / "index.jsx",
        base / "index.ts",
        base / "index.tsx",
    ]
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


def parse_app_import_map() -> Dict[str, str]:
    src = read_text(APP_FILE)
    if not src:
        return {}

    out: Dict[str, str] = {}
    # default import + optional named import
    default_re = re.compile(
        r"import\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:,\s*\{[^}]*\})?\s+from\s+['\"]([^'\"]+)['\"]"
    )
    named_re = re.compile(r"import\s+\{([^}]+)\}\s+from\s+['\"]([^'\"]+)['\"]")

    for match in default_re.finditer(src):
        symbol = match.group(1).strip()
        raw_target = match.group(2).strip()
        resolved = resolve_import_target(APP_FILE, raw_target)
        if resolved:
            out[symbol] = str(resolved.relative_to(REPO_ROOT))

    for match in named_re.finditer(src):
        raw_symbols = match.group(1)
        raw_target = match.group(2).strip()
        resolved = resolve_import_target(APP_FILE, raw_target)
        if not resolved:
            continue
        for part in raw_symbols.split(","):
            token = part.strip()
            if not token:
                continue
            # Handles `Foo as Bar`
            if " as " in token:
                _, alias = [x.strip() for x in token.split(" as ", 1)]
                symbol = alias
            else:
                symbol = token
            out[symbol] = str(resolved.relative_to(REPO_ROOT))
    return out


def inspect_frontend_surface(file_rel: str) -> Dict[str, List[str]]:
    file_path = REPO_ROOT / file_rel
    src = read_text(file_path)
    if not src:
        return {"hooks": [], "endpoints": [], "edge_functions": []}

    hook_matches = sorted(
        {
            m.group(1).strip()
            for m in re.finditer(r"from\s+['\"][^'\"]*/hooks/([^'\"]+)['\"]", src)
        }
    )
    endpoint_matches = sorted(
        {
            m.group(1).strip()
            for m in re.finditer(r"['\"](/[^'\"?#]+)['\"]", src)
            if not m.group(1).startswith("//")
        }
    )
    edge_matches = sorted(
        {
            m.group(1).strip()
            for m in re.finditer(r"callEdgeFunction\(\s*['\"]([^'\"]+)['\"]", src)
        }
    )
    return {
        "hooks": hook_matches[:40],
        "endpoints": endpoint_matches[:80],
        "edge_functions": edge_matches[:40],
    }


def parse_frontend_route_lineage() -> List[Dict[str, Any]]:
    src = read_text(APP_FILE)
    if not src:
        return []
    import_map = parse_app_import_map()
    route_re = re.compile(
        r"<Route\s+path=\"([^\"]+)\"[^>]*element=\{(.*?)\}\s*/?>",
        re.DOTALL,
    )
    tag_re = re.compile(r"<([A-Z][A-Za-z0-9_]*)")

    lineage: List[Dict[str, Any]] = []
    for match in route_re.finditer(src):
        path = match.group(1).strip()
        expr = match.group(2)
        chain = tag_re.findall(expr)
        if not chain:
            continue
        leaf = chain[-1]
        wrappers = chain[:-1]
        leaf_source = import_map.get(leaf, str(APP_FILE.relative_to(REPO_ROOT)))
        surface = inspect_frontend_surface(leaf_source)
        lineage.append(
            {
                "path": path,
                "component_chain": chain,
                "wrappers": wrappers,
                "leaf_component": leaf,
                "leaf_source_file": leaf_source,
                "hooks": surface["hooks"],
                "backend_endpoints": surface["endpoints"],
                "edge_functions": surface["edge_functions"],
            }
        )
    return lineage


def classify_unlinked_routes(route_lineage: Sequence[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    expected: List[Dict[str, Any]] = []
    unexpected: List[Dict[str, Any]] = []
    expected_prefixes = (
        "/platform",
        "/intelligence",
        "/our-integrations",
        "/pricing",
        "/trust",
        "/contact",
        "/knowledge-base",
        "/blog",
        "/landing-intelligent",
        "/terms",
        "/site",
        "/cognitive-v2-preview",
        "/loading-preview",
        "/calibration-preview",
    )
    for entry in route_lineage:
        if entry.get("backend_endpoints"):
            continue
        path = str(entry.get("path", ""))
        leaf_source = str(entry.get("leaf_source_file", ""))
        wrappers = set(entry.get("wrappers") or [])
        reasons: List[str] = []
        if path == "/" or path.startswith(expected_prefixes):
            reasons.append("public_or_static_route")
        if "/pages/website/" in leaf_source or "/components/website/" in leaf_source:
            reasons.append("website_surface")
        if wrappers.intersection({"Navigate", "PublicRoute", "ProtectedRoute", "LaunchRoute"}):
            reasons.append("routing_wrapper_surface")
        if "AuthCallback" in leaf_source or "Login" in leaf_source or "Register" in leaf_source:
            reasons.append("auth_surface")
        item = {
            "path": path,
            "leaf_component": entry.get("leaf_component"),
            "leaf_source_file": leaf_source,
            "reasons": reasons or ["needs_classification"],
        }
        if reasons:
            expected.append(item)
        else:
            unexpected.append(item)
    return {"expected_unlinked": expected, "unexpected_unlinked": unexpected}


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
            function_idx = None
            for j in range(idx + 1, min(idx + 30, len(lines))):
                fmatch = fn_re.search(lines[j])
                if fmatch:
                    function_name = fmatch.group(1)
                    function_idx = j
                    break

            auth_required = False
            if function_idx is not None:
                fn_window = "\n".join(lines[function_idx : min(function_idx + 40, len(lines))])
                auth_required = "Depends(get_current_user)" in fn_window

            out.append(
                BackendEndpoint(
                    file=str(file.relative_to(REPO_ROOT)),
                    method=method,
                    path=f"/api{route_path}",
                    function_name=function_name,
                    auth_required=auth_required,
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


def build_backend_contract_matrix(
    endpoints: Sequence[BackendEndpoint],
) -> List[Dict[str, Any]]:
    by_method = {
        "GET": [200, 400, 401, 403, 404, 422, 429, 500],
        "POST": [200, 201, 400, 401, 403, 409, 422, 429, 500],
        "PUT": [200, 400, 401, 403, 404, 409, 422, 429, 500],
        "PATCH": [200, 400, 401, 403, 404, 409, 422, 429, 500],
        "DELETE": [200, 202, 204, 400, 401, 403, 404, 409, 422, 429, 500],
    }
    out: List[Dict[str, Any]] = []
    for e in endpoints:
        statuses = list(by_method.get(e.method, [200, 400, 401, 403, 422, 500]))
        if not e.auth_required:
            statuses = [s for s in statuses if s not in (401, 403)] + [401]
            statuses = sorted(set(statuses))
        out.append(
            {
                "method": e.method,
                "path": e.path,
                "function_name": e.function_name,
                "auth_required": e.auth_required,
                "owner": "backend/api",
                "expected_statuses": statuses,
                "expected_status_classes": sorted({f"{s // 100}xx" for s in statuses}),
                "policy": "strict_http_contract_v1",
            }
        )
    return out


def build_edge_contract_matrix(
    edge_functions: Sequence[str],
    deploy_analysis: Dict[str, object],
) -> List[Dict[str, Any]]:
    critical = {
        item["function"]: item
        for item in (deploy_analysis.get("critical_probe_contracts") or [])
        if isinstance(item, dict) and item.get("function")
    }
    out: List[Dict[str, Any]] = []
    for fn in edge_functions:
        probe = critical.get(fn)
        if probe:
            statuses = sorted(set(int(x) for x in probe.get("allowed_statuses", [])))
            policy = "critical_probe_contract_v1"
        else:
            statuses = [200, 400, 401, 403, 404, 422, 429, 500]
            policy = "default_edge_contract_v1"
        out.append(
            {
                "function": fn,
                "owner": "platform/edge",
                "expected_statuses": statuses,
                "expected_status_classes": sorted({f"{s // 100}xx" for s in statuses}),
                "policy": policy,
            }
        )
    return out


def summarise(
    routes: Sequence[RouteRecord],
    route_lineage: Sequence[Dict[str, Any]],
    unlinked_classification: Dict[str, List[Dict[str, Any]]],
    endpoints: Sequence[BackendEndpoint],
    edge_functions: Sequence[str],
    vendor_findings: Dict[str, List[Dict[str, object]]],
    visible_vendor_findings: Dict[str, List[Dict[str, object]]],
    deploy_analysis: Dict[str, object],
) -> Dict[str, object]:
    vendor_count = sum(len(v) for v in vendor_findings.values())
    visible_vendor_count = sum(len(v) for v in visible_vendor_findings.values())
    lineage_with_backends = sum(1 for item in route_lineage if item.get("backend_endpoints"))
    expected_unlinked = len(unlinked_classification.get("expected_unlinked", []))
    unexpected_unlinked = len(unlinked_classification.get("unexpected_unlinked", []))
    return {
        "frontend_routes": len(routes),
        "frontend_route_lineage_entries": len(route_lineage),
        "lineage_routes_with_backend_links": lineage_with_backends,
        "lineage_expected_unlinked_routes": expected_unlinked,
        "lineage_unexpected_unlinked_routes": unexpected_unlinked,
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
    route_lineage = parse_frontend_route_lineage()
    unlinked_classification = classify_unlinked_routes(route_lineage)
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
            route_lineage,
            unlinked_classification,
            endpoints,
            edge_functions,
            vendor_findings,
            visible_vendor_findings,
            deploy_analysis,
        ),
        "frontend_routes": [asdict(r) for r in routes],
        "route_lineage_map": route_lineage,
        "route_lineage_unlinked_classification": unlinked_classification,
        "backend_endpoints": [asdict(e) for e in endpoints],
        "edge_functions": edge_functions,
        "vendor_branding_findings": vendor_findings,
        "vendor_branding_likely_visible_findings": visible_vendor_findings,
        "deploy_workflow_analysis": deploy_analysis,
        "contract_matrix": {
            "backend_endpoints": build_backend_contract_matrix(endpoints),
            "edge_functions": build_edge_contract_matrix(edge_functions, deploy_analysis),
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

