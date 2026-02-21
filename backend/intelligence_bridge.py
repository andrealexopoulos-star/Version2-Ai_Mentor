"""
Intelligence Bridge — Connects Watchtower findings + Snapshots → Intelligence Actions + Notifications

This module bridges the gap between BIQc's detection layer (Watchtower, Snapshots)
and the action layer (Intelligence Actions, Notifications).

Called after:
1. A new snapshot is generated
2. Watchtower detects a position change
3. Scheduled analysis runs
"""
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)


async def bridge_snapshot_to_actions(supabase, user_id: str, snapshot: Dict[str, Any]) -> int:
    """
    Convert snapshot open_risks and contradictions into intelligence_actions.
    Returns count of actions created.
    """
    created = 0
    existing = supabase.table("intelligence_actions").select("source_id").eq(
        "user_id", user_id
    ).execute()
    existing_source_ids = {a.get("source_id") for a in (existing.data or [])}

    # Convert open risks to actions
    for risk in snapshot.get("open_risks", []):
        source_id = f"risk_{risk['domain']}_{snapshot['id'][:8]}"
        if source_id in existing_source_ids:
            continue

        severity = "high" if risk["position"] in ("CRITICAL", "DETERIORATING") else "medium"
        persistence = risk.get("persistence_hours")
        persistence_text = f" (persisting {persistence}h)" if persistence else ""

        action_data = {
            "id": str(uuid4()),
            "user_id": user_id,
            "source": "watchtower",
            "source_id": source_id,
            "domain": risk["domain"],
            "severity": severity,
            "title": f"{risk['domain'].title()} position: {risk['position']}",
            "description": f"Your {risk['domain']} domain has moved to {risk['position']}{persistence_text}. Detected {risk.get('times_detected', 1)} time(s).",
            "suggested_action": _suggest_action_for_risk(risk),
            "status": "action_required",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            supabase.table("intelligence_actions").insert(action_data).execute()
            created += 1
        except Exception as e:
            logger.warning(f"[bridge] Failed to insert action: {e}")

    # Convert contradictions to actions
    for contradiction in snapshot.get("contradictions", []):
        source_id = f"contra_{contradiction.get('domain', 'unknown')}_{snapshot['id'][:8]}"
        if source_id in existing_source_ids:
            continue

        action_data = {
            "id": str(uuid4()),
            "user_id": user_id,
            "source": "contradiction_engine",
            "source_id": source_id,
            "domain": contradiction.get("domain", "general"),
            "severity": "medium",
            "title": f"Contradiction detected in {contradiction.get('domain', 'your data')}",
            "description": f"A {contradiction.get('type', 'data')} contradiction has been detected {contradiction.get('times_detected', 1)} time(s). This may indicate conflicting signals in your business data.",
            "suggested_action": "Review the conflicting data points and confirm which is accurate",
            "status": "action_required",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            supabase.table("intelligence_actions").insert(action_data).execute()
            created += 1
        except Exception as e:
            logger.warning(f"[bridge] Failed to insert contradiction action: {e}")

    if created > 0:
        logger.info(f"[bridge] Created {created} intelligence actions for user {user_id}")

    return created


async def bridge_watchtower_to_actions(supabase, user_id: str, finding: Dict[str, Any]) -> bool:
    """
    Convert a single Watchtower finding into an intelligence action.
    Returns True if action was created.
    """
    source_id = f"wt_{finding.get('id', str(uuid4())[:8])}"

    existing = supabase.table("intelligence_actions").select("id").eq(
        "source_id", source_id
    ).eq("user_id", user_id).maybe_single().execute()

    if existing.data:
        return False

    severity = "high" if finding.get("new_position") in ("CRITICAL", "DETERIORATING") else "medium"

    action_data = {
        "id": str(uuid4()),
        "user_id": user_id,
        "source": "watchtower",
        "source_id": source_id,
        "domain": finding.get("domain", "general"),
        "severity": severity,
        "title": f"{finding.get('domain', 'Business').title()}: {finding.get('old_position', '?')} → {finding.get('new_position', '?')}",
        "description": finding.get("reason", "Position change detected by Watchtower."),
        "suggested_action": _suggest_action_for_domain(finding.get("domain")),
        "status": "action_required",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        supabase.table("intelligence_actions").insert(action_data).execute()
        logger.info(f"[bridge] Created watchtower action for {finding.get('domain')} → {finding.get('new_position')}")
        return True
    except Exception as e:
        logger.warning(f"[bridge] Failed to insert watchtower action: {e}")
        return False


def _suggest_action_for_risk(risk: Dict[str, Any]) -> str:
    """Generate a contextual suggested action based on the risk domain and severity."""
    domain = risk.get("domain", "")
    position = risk.get("position", "")

    suggestions = {
        ("finance", "CRITICAL"): "Review cash position immediately. Check outstanding invoices and upcoming payments.",
        ("finance", "DETERIORATING"): "Investigate cash flow trend. Consider following up on overdue invoices.",
        ("sales", "CRITICAL"): "Pipeline requires immediate attention. Review deal stages and client engagement.",
        ("sales", "DETERIORATING"): "Sales velocity is slowing. Review lead follow-up timing and conversion rates.",
        ("operations", "CRITICAL"): "Operational breakdown detected. Review team workload and process compliance.",
        ("operations", "DETERIORATING"): "Operational drift detected. Check SOP adherence and task completion rates.",
        ("team", "CRITICAL"): "Team signals are concerning. Review workload distribution and engagement.",
        ("team", "DETERIORATING"): "Team dynamics shifting. Monitor communication patterns and meeting frequency.",
        ("market", "CRITICAL"): "Market conditions have shifted significantly. Review competitive positioning.",
        ("market", "DETERIORATING"): "Market signals weakening. Check competitor activity and customer sentiment.",
    }

    return suggestions.get((domain, position), f"Review your {domain} position and take corrective action.")


def _suggest_action_for_domain(domain: Optional[str]) -> str:
    """Suggest a default action based on domain."""
    domain_actions = {
        "finance": "Review your financial dashboard and check for anomalies.",
        "sales": "Check your pipeline and follow up on stalled deals.",
        "operations": "Review operational metrics and task completion rates.",
        "team": "Check team engagement and workload balance.",
        "market": "Review competitor activity and market signals.",
    }
    return domain_actions.get(domain or "", "Review the intelligence briefing for details.")
