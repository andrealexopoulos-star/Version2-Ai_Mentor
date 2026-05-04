from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]

HEALTH_CONTRACT_TARGETS = [
    (
        "supabase/functions/calibration-business-dna/index.ts",
        "calibration-business-dna",
    ),
    (
        "supabase/functions/scrape-business-profile/index.ts",
        "scrape-business-profile",
    ),
    (
        "supabase/functions/deep-web-recon/index.ts",
        "deep-web-recon",
    ),
    (
        "supabase/functions/social-enrichment/index.ts",
        "social-enrichment",
    ),
    (
        "supabase/functions/browse-ai-reviews/index.ts",
        "browse-ai-reviews",
    ),
    (
        "supabase/functions/semrush-domain-intel/index.ts",
        "semrush-domain-intel",
    ),
    (
        "supabase/functions/market-analysis-ai/index.ts",
        "market-analysis-ai",
    ),
    (
        "supabase/functions/market-signal-scorer/index.ts",
        "market-signal-scorer",
    ),
    (
        "supabase/functions/calibration-psych/index.ts",
        "calibration-psych",
    ),
    (
        "supabase/functions/calibration-sync/index.ts",
        "calibration-sync",
    ),
    (
        "supabase/functions/calibration-engine/index.ts",
        "calibration-engine",
    ),
    (
        "supabase/functions/competitor-monitor/index.ts",
        "competitor-monitor",
    ),
    # P0 Marjo F14 (2026-05-04) — close perimeter gap for the two new
    # deep-extraction edge functions added by R2B + R2C. Both ARE in the
    # calibration scan fanout (asyncio.gather in calibration.py:~2655) and
    # therefore MUST appear in the health contract per
    # feedback_zero_401_tolerance.md (no edge fn in scan path may silently
    # 401 in prod) and BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2.
    (
        "supabase/functions/customer-reviews-deep/index.ts",
        "customer-reviews-deep",
    ),
    (
        "supabase/functions/staff-reviews-deep/index.ts",
        "staff-reviews-deep",
    ),
]


def _read(rel_path: str) -> str:
    return (REPO_ROOT / rel_path).read_text(encoding="utf-8")


def test_calibration_edge_sources_expose_get_health_contract():
    for rel_path, function_name in HEALTH_CONTRACT_TARGETS:
        content = _read(rel_path)
        assert 'req.method === "GET"' in content, f"Missing GET health handler in {rel_path}"
        assert ("ok: true" in content) or ('"ok": true' in content), f"Missing ok flag in {rel_path}"
        assert "reachable" in content, f"Missing reachable key in {rel_path}"
        assert "generated_at" in content, f"Missing generated_at key in {rel_path}"
        assert (
            f'function: "{function_name}"' in content
            or f'"function":"{function_name}"' in content
            or f'function: "{function_name.replace("-", "_")}"' in content
        ), f"Missing function identity in {rel_path}"


def test_supabase_functions_workflow_smokes_calibration_health_contract():
    workflow = _read(".github/workflows/supabase-functions-deploy.yml")
    assert "Calibration edge health smoke" in workflow
    assert "Verify calibration edge runtime secrets" in workflow
    for _, function_name in HEALTH_CONTRACT_TARGETS:
        assert function_name in workflow, f"Workflow missing health smoke target: {function_name}"

