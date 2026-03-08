"""
Data Coverage Engine — Sprint 4
Calculates how much data is available for AI analysis, per domain.
Used to gate SoundBoard responses (blocked / degraded / full).
"""
from datetime import datetime, timezone
from typing import Dict, List, Tuple

# ─── Field schema ───────────────────────────────────────────────────────────
# Each entry: (field_key, domain, weight, source)
#   weight 2 = critical, weight 1 = optional
#   source = 'profile' | 'integration_crm' | 'integration_accounting' | 'integration_email' | 'calibration'

FIELD_SCHEMA = [
    # ── Calibration base (all domains) ──
    ("business_name",           "base",       2, "profile"),
    ("industry",                "base",       2, "profile"),
    ("location",                "base",       1, "profile"),

    # ── Revenue domain ──
    ("revenue_range",           "revenue",    2, "profile"),
    ("customer_count",          "revenue",    1, "profile"),
    ("pricing_model",           "revenue",    1, "profile"),
    ("business_model",          "revenue",    1, "profile"),
    ("crm_deals",               "revenue",    2, "integration_crm"),    # live

    # ── Cash domain ──
    ("accounting_invoices",     "cash",       2, "integration_accounting"),  # live
    ("burn_rate",               "cash",       1, "profile"),
    ("funding_stage",           "cash",       1, "profile"),

    # ── Operations domain ──
    ("main_challenges",         "operations", 2, "profile"),
    ("short_term_goals",        "operations", 2, "profile"),
    ("operational_model",       "operations", 1, "profile"),
    ("tech_stack",              "operations", 1, "profile"),
    ("sales_process",           "operations", 1, "profile"),

    # ── People domain ──
    ("team_size",               "people",     2, "profile"),
    ("email_connected",         "people",     1, "integration_email"),  # live

    # ── Market domain ──
    ("target_market",           "market",     2, "profile"),
    ("unique_value_proposition","market",     1, "profile"),
    ("key_competitors",         "market",     1, "profile"),
    ("marketing_channels",      "market",     1, "profile"),
]

# Max possible points per domain
DOMAIN_MAX = {}
for _field, _domain, _weight, _source in FIELD_SCHEMA:
    DOMAIN_MAX[_domain] = DOMAIN_MAX.get(_domain, 0) + _weight

TOTAL_MAX = sum(DOMAIN_MAX.values())

# Friendly labels for missing fields UI
FIELD_LABELS = {
    "business_name":            ("Business Name",           "/settings"),
    "industry":                 ("Industry",                "/settings"),
    "location":                 ("Location",                "/settings"),
    "revenue_range":            ("Revenue Range",           "/calibration"),
    "customer_count":           ("Customer Count",          "/calibration"),
    "pricing_model":            ("Pricing Model",           "/calibration"),
    "business_model":           ("Business Model",          "/calibration"),
    "crm_deals":                ("CRM (pipeline data)",     "/integrations"),
    "accounting_invoices":      ("Accounting (invoices)",   "/integrations"),
    "burn_rate":                ("Monthly Burn Rate",       "/calibration"),
    "funding_stage":            ("Funding Stage",           "/calibration"),
    "main_challenges":          ("Current Challenges",      "/calibration"),
    "short_term_goals":         ("Short-term Goals",        "/calibration"),
    "operational_model":        ("Operations Model",        "/calibration"),
    "tech_stack":               ("Technology Stack",        "/calibration"),
    "sales_process":            ("Sales Process",           "/calibration"),
    "team_size":                ("Team Size",               "/calibration"),
    "email_connected":          ("Email Integration",       "/integrations"),
    "target_market":            ("Target Market",           "/calibration"),
    "unique_value_proposition": ("Unique Value Proposition","/calibration"),
    "key_competitors":          ("Key Competitors",         "/calibration"),
    "marketing_channels":       ("Marketing Channels",      "/calibration"),
}


def calculate_coverage(
    profile: dict,
    has_crm: bool = False,
    has_accounting: bool = False,
    has_email: bool = False,
) -> dict:
    """
    Calculate data coverage percentage overall and per domain.
    Returns:
        coverage_pct: int (0-100)
        per_domain: dict[domain -> {pct, earned, max}]
        missing_fields: list[{key, label, path, critical}]
        missing_critical: list[str]  -- keys only
        guardrail_status: 'BLOCKED' | 'DEGRADED' | 'FULL'
    """
    integration_flags = {
        "crm_deals": has_crm,
        "accounting_invoices": has_accounting,
        "email_connected": has_email,
    }

    earned_total = 0
    earned_per_domain: Dict[str, int] = {}
    missing_fields: List[dict] = []
    missing_critical: List[str] = []

    for field_key, domain, weight, source in FIELD_SCHEMA:
        populated = False

        if source == "profile":
            val = profile.get(field_key) if profile else None
            populated = bool(val and str(val) not in ("", "None", "0"))
        elif source.startswith("integration_"):
            populated = integration_flags.get(field_key, False)
        elif source == "calibration":
            val = profile.get(field_key) if profile else None
            populated = bool(val and str(val) not in ("", "None", "0"))

        if populated:
            earned_total += weight
            earned_per_domain[domain] = earned_per_domain.get(domain, 0) + weight
        else:
            label, path = FIELD_LABELS.get(field_key, (field_key, "/settings"))
            missing_fields.append({
                "key": field_key,
                "label": label,
                "path": path,
                "critical": weight == 2,
                "domain": domain,
            })
            if weight == 2:
                missing_critical.append(field_key)

    coverage_pct = round((earned_total / TOTAL_MAX) * 100)

    per_domain = {}
    for domain, max_pts in DOMAIN_MAX.items():
        earned = earned_per_domain.get(domain, 0)
        per_domain[domain] = {
            "pct": round((earned / max_pts) * 100) if max_pts > 0 else 0,
            "earned": earned,
            "max": max_pts,
        }

    # Gating thresholds
    if coverage_pct < 20:
        guardrail_status = "BLOCKED"
    elif coverage_pct < 40:
        guardrail_status = "DEGRADED"
    else:
        guardrail_status = "FULL"

    return {
        "coverage_pct": coverage_pct,
        "per_domain": per_domain,
        "missing_fields": missing_fields,
        "missing_critical": missing_critical,
        "guardrail_status": guardrail_status,
        "earned_points": earned_total,
        "total_points": TOTAL_MAX,
    }
