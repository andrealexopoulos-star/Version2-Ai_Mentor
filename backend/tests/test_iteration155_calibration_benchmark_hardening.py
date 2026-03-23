"""
Iteration 155 - Calibration and benchmark hardening regression checks.

Static safeguards for:
1) Calibration route access is not force-redirected away in ProtectedRoute.
2) Auth bootstrap uses fail-closed calibration truth (no unconditional fail-open).
3) Legacy competitive benchmark endpoints exist for backward compatibility.
"""

from pathlib import Path


_REPO_ROOT = Path(__file__).resolve().parents[2]


def _read_repo(*parts: str) -> str:
    return _REPO_ROOT.joinpath(*parts).read_text(encoding="utf-8")


def test_protected_route_allows_calibration_path():
    content = _read_repo("frontend", "src", "components", "ProtectedRoute.js")
    assert (
        "if (isCalibrationRoute) return children;" in content
    ), "ProtectedRoute should allow /calibration path during loading/ready states"
    assert (
        'return <Navigate to="/advisor" replace />;' not in content.split("if (isCalibrationRoute)", 1)[1][:220]
    ), "Calibration route must not be force-redirected to /advisor"


def test_auth_bootstrap_is_fail_closed_for_calibration_errors():
    content = _read_repo("frontend", "src", "context", "SupabaseAuthContext.js")
    lowered = content.lower()
    assert "fetch failed" in lowered and "fail-closed" in lowered, (
        "Auth bootstrap should fail-closed to calibration when routing truth is unavailable"
    )
    assert "calibrationComplete = false;" in content, (
        "Calibration status fetch errors should not mark user READY by default"
    )


def test_marketing_intel_has_legacy_competitive_endpoints():
    content = _read_repo("backend", "routes", "marketing_intel.py")
    assert '@router.get("/competitive-benchmark/scores")' in content
    assert '@router.post("/competitive-benchmark/refresh")' in content
