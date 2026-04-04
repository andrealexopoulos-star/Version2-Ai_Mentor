#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
REPORTS_DIR = REPO_ROOT / "reports"
TEST_REPORTS_DIR = REPO_ROOT / "test_reports"


def latest_surface_audit() -> Path:
    files = sorted(
        TEST_REPORTS_DIR.glob("platform_surface_200_audit_*.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not files:
        raise FileNotFoundError("No platform_surface_200_audit_*.json found in test_reports/")
    return files[0]


def main() -> int:
    src = latest_surface_audit()
    payload = json.loads(src.read_text(encoding="utf-8"))
    rows = payload.get("results", [])

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out = REPORTS_DIR / f"BIQC_SURFACE_FORENSIC_MATRIX_EXHAUSTIVE_{ts}.csv"

    fields = [
        "surface_id",
        "page",
        "component",
        "method",
        "source_file",
        "data_source_endpoint",
        "probe_url",
        "http_status",
        "result",
        "current_state",
        "required_state",
        "gap_type",
    ]

    with out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for idx, r in enumerate(rows, start=1):
            status = int(r.get("http_status") or 0)
            result = r.get("result") or ("PASS" if status == 200 else "FAIL")
            endpoint = r.get("endpoint") or ""
            current_state = "transport_200" if status == 200 else f"transport_{status}"
            if endpoint == "NO_API_CALL_DETECTED":
                required = "static_route_render_200"
                gap = "-" if status == 200 else "transport"
            else:
                required = "transport_200_plus_semantic_payload_contract"
                gap = "-" if status == 200 else "transport"
            writer.writerow(
                {
                    "surface_id": f"SURFACE-{idx:04d}",
                    "page": r.get("page") or "",
                    "component": r.get("component") or "",
                    "method": r.get("method") or "",
                    "source_file": r.get("source_file") or "",
                    "data_source_endpoint": endpoint,
                    "probe_url": r.get("probe_url") or "",
                    "http_status": status,
                    "result": result,
                    "current_state": current_state,
                    "required_state": required,
                    "gap_type": gap,
                }
            )

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": str(src.relative_to(REPO_ROOT)),
        "artifact": str(out.relative_to(REPO_ROOT)),
        "total_rows": len(rows),
        "pass_rows": sum(1 for r in rows if int(r.get("http_status") or 0) == 200),
        "fail_rows": sum(1 for r in rows if int(r.get("http_status") or 0) != 200),
    }
    summary_out = TEST_REPORTS_DIR / f"surface_forensic_matrix_build_{ts}.json"
    summary_out.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps({"passed": summary["fail_rows"] == 0, "artifact": summary["artifact"], "summary": summary}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
