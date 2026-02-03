"""
BIQc Watchtower — Server-Side Intelligence Engine
RPC-Based Cold Read (High-Performance)

Executes intelligence logic in PostgreSQL, not Python.
"""

import logging
from datetime import datetime
from typing import Dict, Any
from uuid import uuid4

logger = logging.getLogger(__name__)


async def generate_cold_read(
    user_id: str,
    account_id: str,
    supabase_admin: Any,
    watchtower_store: Any
) -> Dict[str, Any]:
    """
    Executes the Cold Read using High-Performance Database RPCs.
    No local processing. No limits.
    """
    insights = []
    
    # 1. CHECK FOR GHOSTING (RPC Call)
    # Scans 180 days of history instantly
    try:
        response = supabase_admin.rpc('analyze_ghosted_vips', {
            'target_user_id': user_id, 
            'lookback_days': 180,
            'silence_threshold_days': 21
        }).execute()
        
        ghosts = response.data
        if ghosts:
            top_ghost = ghosts[0]  # Get the highest volume ghost
            
            # Parse last_contact
            if isinstance(top_ghost['last_contact'], str):
                last_contact_dt = datetime.fromisoformat(top_ghost['last_contact'].replace('Z', ''))
            else:
                last_contact_dt = top_ghost['last_contact']
            
            days_silent = (datetime.now() - last_contact_dt).days
            
            insights.append({
                "id": str(uuid4()),
                "account_id": account_id,
                "user_id": user_id,
                "type": "risk",
                "domain": "communications",
                "severity": "critical",
                "headline": f"Relationship Risk: {top_ghost['sender_email']}",
                "statement": f"This contact sent {top_ghost['msg_count']} emails historically but has been silent for {days_silent} days.",
                "evidence_payload": {
                    "last_contact_days_ago": days_silent,
                    "previous_volume": int(top_ghost['msg_count']),
                    "status": "Silent",
                    "sender_email": top_ghost['sender_email']
                },
                "confidence_level": "high",
                "consequence_window": "Relationship at risk",
                "source": "supabase_rpc_ghosting",
                "fingerprint": f"ghost_{top_ghost['sender_email'][:20]}",
                "status": "active",
                "created_at": datetime.now().isoformat()
            })
            
        logger.info(f"✅ Ghosting RPC: {len(ghosts)} contacts analyzed")
    except Exception as e:
        logger.error(f"Ghosting RPC Failed: {e}")

    # 2. CHECK FOR BURNOUT (RPC Call)
    try:
        response = supabase_admin.rpc('analyze_burnout_risk', {
            'target_user_id': user_id
        }).execute()
        
        late_emails = response.data  # Returns an integer
        if late_emails and late_emails > 3:
            insights.append({
                "id": str(uuid4()),
                "account_id": account_id,
                "user_id": user_id,
                "type": "anomaly",
                "domain": "operations",
                "severity": "medium",
                "headline": "Burnout Pattern Detected",
                "statement": f"{late_emails} emails sent between 11pm-5am in the last 7 days. This indicates workload pressure or timezone misalignment.",
                "evidence_payload": {
                    "late_night_emails_7d": int(late_emails),
                    "threshold": 3
                },
                "confidence_level": "moderate",
                "consequence_window": "Monitor for sustained pattern",
                "source": "supabase_rpc_burnout",
                "fingerprint": "burnout_pattern",
                "status": "active",
                "created_at": datetime.now().isoformat()
            })
            
        logger.info(f"✅ Burnout RPC: {late_emails} late-night sends detected")
    except Exception as e:
        logger.error(f"Burnout RPC Failed: {e}")

    # 3. SAVE TO WATCHTOWER
    if insights:
        for insight in insights:
            await watchtower_store.create_event(insight)
        
        logger.info(f"🎯 Cold Read Complete: {len(insights)} insights generated via RPCs")
        return {
            "events_created": len(insights),
            "status": "complete",
            "method": "supabase_rpc"
        }
    
    logger.info("ℹ️ Cold Read Complete: No patterns detected")
    return {
        "events_created": 0,
        "status": "no_patterns",
        "method": "supabase_rpc"
    }
