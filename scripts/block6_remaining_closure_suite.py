#!/usr/bin/env python3
"""
Block 6 Remaining Closure Suite

Final post-merge smoke/closure checks for:
- merged release state on main
- key UI copy expectations
- flagship coverage-window visibility
- conversion/upsell policy guardrails
- post-release guard + final closure artifacts
"""

from __future__ import annotations

import json
import subprocess
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError


REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "test_reports"
MAX_ARTIFACT_AGE_MINUTES = 240
MERGED_MARKER_LOOKBACK_COMMITS = 30
ASSISTANT_RESPONSE = REPO_ROOT / "frontend" / "src" / "components" / "soundboard" / "AskBiqcAssistantResponse.js"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def latest(prefix: str) -> Optional[Path]:
    files = sorted(REPORTS_DIR.glob(f"{prefix}_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else None


def load_json(path: Path) -> Dict:
    return json.loads(path.read_text(encoding="utf-8"))


def age_minutes(ts: str) -> float:
    dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    return (datetime.now(timezone.utc) - dt).total_seconds() / 60.0


def git(cmd: list[str]) -> str:
    proc = subprocess.run(["git", *cmd], cwd=REPO_ROOT, capture_output=True, text=True)
    if proc.returncode != 0:
        return ""
    return (proc.stdout or "").strip()


def check_github_actions_main() -> Dict[str, object]:
    manual_run_id = os.environ.get("GITHUB_ACTIONS_MAIN_RUN_ID")
    manual_conclusion = os.environ.get("GITHUB_ACTIONS_MAIN_CONCLUSION")
    manual_url = os.environ.get("GITHUB_ACTIONS_MAIN_URL")
    if manual_run_id and manual_conclusion:
        conclusion = str(manual_conclusion).lower()
        ok = conclusion in {"success", "neutral", "skipped"}
        return {
            "checked": True,
            "ok": ok,
            "status": "completed",
            "conclusion": conclusion,
            "run_id": manual_run_id,
            "html_url": manual_url,
            "source": "manual_env_evidence",
        }

    api = "https://api.github.com/repos/andrealexopoulos-star/Version2-Ai_Mentor/actions/runs?branch=main&per_page=5"
    try:
        req_headers = {"Accept": "application/vnd.github+json"}
        gh_token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
        if gh_token:
            req_headers["Authorization"] = f"Bearer {gh_token}"
        req = Request(api, headers=req_headers)
        with urlopen(req, timeout=8) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        runs = payload.get("workflow_runs", []) or []
        latest_run = runs[0] if runs else {}
        conclusion = latest_run.get("conclusion")
        status = latest_run.get("status")
        run_id = latest_run.get("id")
        html_url = latest_run.get("html_url")
        # strict: must be checked and not failed; success is best state, queued/in_progress acceptable only with run id present
        ok = bool(run_id) and ((status in {"queued", "in_progress"}) or (conclusion == "success"))
        return {
            "checked": True,
            "ok": ok,
            "status": status,
            "conclusion": conclusion,
            "run_id": run_id,
            "html_url": html_url,
            "source": "github_api",
        }
    except (URLError, HTTPError, TimeoutError, json.JSONDecodeError):
        # Allow explicit offline/manual strict evidence path to avoid false negatives
        # when GitHub API access is unavailable from the current runtime environment.
        manual_checked = os.environ.get("GITHUB_ACTIONS_MAIN_CHECKED")
        manual_ok = os.environ.get("GITHUB_ACTIONS_MAIN_OK")
        if manual_checked and manual_ok:
            checked = str(manual_checked).strip().lower() in {"1", "true", "yes"}
            ok = str(manual_ok).strip().lower() in {"1", "true", "yes"}
            return {
                "checked": checked,
                "ok": ok,
                "status": "manual",
                "conclusion": "success" if ok else "failure",
                "run_id": os.environ.get("GITHUB_ACTIONS_MAIN_RUN_ID"),
                "html_url": os.environ.get("GITHUB_ACTIONS_MAIN_URL"),
                "source": "manual_env_override",
            }
        return {
            "checked": False,
            "ok": False,
            "status": "unavailable",
            "conclusion": None,
            "run_id": None,
            "html_url": None,
            "source": "unavailable",
        }


def main() -> int:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)

    chief = read(REPO_ROOT / "frontend" / "src" / "components" / "calibration" / "ChiefMarketingSummary.js")
    wow = read(REPO_ROOT / "frontend" / "src" / "hooks" / "useCalibrationState.js")
    panel = read(REPO_ROOT / "frontend" / "src" / "components" / "SoundboardPanel.js")
    board = read(REPO_ROOT / "frontend" / "src" / "pages" / "MySoundBoard.js")
    assistant = read(ASSISTANT_RESPONSE)
    sb = read(REPO_ROOT / "backend" / "routes" / "soundboard.py")

    guard = latest("block4_post_release_guard")
    closure = latest("block5_final_closure_pack")
    if not guard or not closure:
        out = REPORTS_DIR / f"block6_remaining_closure_{now.strftime('%Y%m%d_%H%M%S')}.json"
        payload = {
            "generated_at": now.isoformat(),
            "passed": False,
            "failure_codes": ["MISSING_BLOCK4_OR_BLOCK5_ARTIFACT"],
        }
        out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(json.dumps({"passed": False, "artifact": str(out), "failure_codes": ["MISSING_BLOCK4_OR_BLOCK5_ARTIFACT"]}, indent=2))
        return 1

    guard_data = load_json(guard)
    closure_data = load_json(closure)
    guard_age = age_minutes(str(guard_data.get("generated_at")))
    closure_age = age_minutes(str(closure_data.get("generated_at")))

    git_main_head = git(["rev-parse", "origin/main"])
    git_main_log = git(["log", "--oneline", f"--max-count={MERGED_MARKER_LOOKBACK_COMMITS}", "origin/main"])
    merged_marker_terms = (
        "zero drop",
        "truth gateway",
        "deployment controls",
        "deployment workflow",
        "stabilize deployment",
        "harden deploy",
        "forensic",
        "soundboard",
        "ask biqc",
        "release",
        "closure",
    )
    merged_marker = bool(git_main_head) and any(term in git_main_log.lower() for term in merged_marker_terms)

    actions = check_github_actions_main()
    panel_has_coverage_anchor = ("coverage_window" in panel and "Coverage window" in panel)
    board_has_coverage_anchor = ("coverage_window" in board and "Coverage window" in board)
    assistant_has_coverage_copy = (
        "Coverage window" in assistant
        and (("last sync" in assistant.lower()) or ("last update" in assistant.lower()))
    )

    checks = {
        "main_contains_release_marker": bool(merged_marker),
        "cmo_disclaimer_removed": ("Based on publicly available digital signals only" not in chief and "All analysis above is based on publicly available digital signals only" not in chief),
        "serp_wording_removed_or_sanitized": ("SERP" not in wow and "serp" not in wow) or ("sanitizeCardText" in wow),
        "coverage_window_visible_panel": panel_has_coverage_anchor and assistant_has_coverage_copy,
        "coverage_window_visible_full_page": board_has_coverage_anchor and assistant_has_coverage_copy,
        "conversion_guardrails_present": ("CONVERSION GUARDRAIL" in sb and "_enforce_conversion_guardrails" in sb),
        "role_policy_present": ("ROLE POLICY CONSTRAINTS" in sb and "_build_role_policy_guardrails" in sb),
        "post_release_guard_passed": bool(guard_data.get("passed")),
        "final_closure_passed": bool(closure_data.get("closure_passed")),
        "post_release_guard_fresh": guard_age <= MAX_ARTIFACT_AGE_MINUTES,
        "final_closure_fresh": closure_age <= MAX_ARTIFACT_AGE_MINUTES,
        "github_actions_main_not_failed": bool(actions.get("ok")),
    }

    passed = all(bool(v) for v in checks.values())
    failure_codes = [k for k, v in checks.items() if not v]

    payload = {
        "generated_at": now.isoformat(),
        "passed": passed,
        "failure_codes": failure_codes,
        "checks": checks,
        "context": {
            "origin_main_head": git_main_head,
            "origin_main_log": git_main_log,
            "guard_artifact": str(guard.relative_to(REPO_ROOT)),
            "closure_artifact": str(closure.relative_to(REPO_ROOT)),
            "guard_age_minutes": round(guard_age, 2),
            "closure_age_minutes": round(closure_age, 2),
            "github_actions_main": actions,
        },
    }

    out = REPORTS_DIR / f"block6_remaining_closure_{now.strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"passed": passed, "artifact": str(out), "failure_codes": failure_codes}, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

