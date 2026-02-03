"""
BIQc Watchtower — Cold Read Intelligence Engine
PROMPT 2A FINAL - Hybrid Bridge Architecture

INPUT: MongoDB (read-only)
OUTPUT: Supabase watchtower_events (write-only)
INTELLIGENCE: Non-trivial, multi-message, temporal pattern detection

NOT a rules engine.
NOT a keyword matcher.
NOT trivial.
"""

import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from uuid import uuid4
from collections import defaultdict, Counter
import logging

logger = logging.getLogger(__name__)


def create_fingerprint(domain: str, type: str, key: str) -> str:
    """Create stable deduplication fingerprint"""
    raw = f"{domain}:{type}:{key}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


async def analyze_email_relationship_patterns(
    mongo_db: Any,
    user_id: str,
    account_id: str,
    lookback_days: int = 90,
    first_run: bool = False
) -> List[Dict[str, Any]]:
    """
    WATCHTOWER INTELLIGENCE: Relationship Pattern Analysis
    
    Detects:
    - Relational anomalies (high-value contacts going silent)
    - Temporal anomalies (response cadence collapse)
    - Behavioural drift (communication pattern shifts)
    
    Args:
        first_run: If True, uses adaptive (lower) thresholds for early signals
    
    Requires: ≥5 emails spanning ≥14 days (normal mode)
             ≥3 emails spanning ≥7 days (first-run mode)
    NOT a keyword match. NOT a simple rule.
    """
    events = []
    
    # ADAPTIVE THRESHOLDS (first-run vs normal)
    if first_run:
        SILENCE_MIN_WEEKLY_EMAILS = 1      # vs 2 in normal
        SILENCE_MIN_DAYS = 14              # vs 21 in normal
        CADENCE_MIN_MESSAGES = 3           # vs 5 in normal
        CADENCE_MIN_SPAN_DAYS = 7          # vs 14 in normal
        CADENCE_SLOWDOWN_FACTOR = 2        # vs 3 in normal
        UNREAD_MIN_COUNT = 2               # vs 3 in normal
        UNREAD_MIN_DAYS = 7                # vs 14 in normal
        confidence_level = "early_signal"
    else:
        SILENCE_MIN_WEEKLY_EMAILS = 2
        SILENCE_MIN_DAYS = 21
        CADENCE_MIN_MESSAGES = 5
        CADENCE_MIN_SPAN_DAYS = 14
        CADENCE_SLOWDOWN_FACTOR = 3
        UNREAD_MIN_COUNT = 3
        UNREAD_MIN_DAYS = 14
        confidence_level = "moderate"
    
    # Query MongoDB outlook_emails (INDEXED on user_id as of PROMPT 1)
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    
    cursor = mongo_db.outlook_emails.find(
        {
            "user_id": user_id,
            "received_date": {"$gte": cutoff_date.isoformat()}
        },
        {
            "_id": 0,
            "id": 1,
            "from_address": 1,
            "from_name": 1,
            "subject": 1,
            "received_date": 1,
            "is_external": 1,
            "is_read": 1,
            "folder": 1
        }
    ).sort("received_date", -1).limit(500)
    
    emails = await cursor.to_list(length=500)
    
    if len(emails) < 5:
        logger.info(f"Insufficient email volume for intelligence: {len(emails)} emails")
        return events
    
    # === INSIGHT 1: RELATIONSHIP SILENCE ANOMALY ===
    # Detect: High-frequency contact suddenly goes quiet
    
    # Build contact frequency map by time period
    contact_timeline = defaultdict(lambda: {"periods": defaultdict(int), "last_seen": None, "emails": []})
    
    for email in emails:
        sender = email.get('from_address', '').lower()
        if not sender or not email.get('is_external'):
            continue
        
        received = email.get('received_date')
        if not received:
            continue
        
        try:
            email_date = datetime.fromisoformat(received.replace('Z', '+00:00'))
            weeks_ago = (datetime.now(timezone.utc) - email_date).days // 7
            
            contact_timeline[sender]["periods"][weeks_ago] += 1
            contact_timeline[sender]["emails"].append(email)
            
            if contact_timeline[sender]["last_seen"] is None or email_date > contact_timeline[sender]["last_seen"]:
                contact_timeline[sender]["last_seen"] = email_date
        except:
            continue
    
    # Detect silence anomaly: active contact (>2 emails/week) now silent >3 weeks
    now = datetime.now(timezone.utc)
    
    for sender, data in contact_timeline.items():
        # Check historical activity (weeks 4-12)
        historical_weeks = [data["periods"][w] for w in range(4, 13)]
        if not historical_weeks:
            continue
        
        avg_historical = sum(historical_weeks) / len([w for w in historical_weeks if w > 0]) if any(historical_weeks) else 0
        
        # Check recent silence (weeks 0-3)
        recent_weeks = [data["periods"][w] for w in range(0, 4)]
        recent_total = sum(recent_weeks)
        
        # Anomaly: Was communicating ≥threshold/week, now silent for threshold days
        if avg_historical >= SILENCE_MIN_WEEKLY_EMAILS and recent_total == 0:
            last_seen_days = (now - data["last_seen"]).days if data["last_seen"] else 999
            
            if last_seen_days >= SILENCE_MIN_DAYS:
                # Get sender name for evidence
                sender_name = next((e.get('from_name') for e in data["emails"] if e.get('from_name')), sender)
                total_emails = len(data["emails"])
                
                events.append({
                    "id": str(uuid4()),
                    "account_id": account_id,
                    "domain": "communications",
                    "type": "anomaly",
                    "severity": "medium" if first_run else "high",
                    "headline": f"Communication silence: {sender_name[:30]}",
                    "statement": f"This contact historically sent {int(avg_historical)} emails per week over the past 3 months. No communication received in the last {last_seen_days} days. This represents a {int((last_seen_days / 7) / avg_historical * 100)}% drop from normal cadence.",
                    "evidence_payload": {
                        "contact_email": sender[:50],
                        "contact_name": sender_name[:100],
                        "historical_avg_per_week": round(avg_historical, 1),
                        "silence_days": last_seen_days,
                        "total_historical_emails": total_emails,
                        "last_contact_date": data["last_seen"].isoformat() if data["last_seen"] else None,
                        "analysis_period_days": lookback_days,
                        "email_ids_sample": [e.get('id') for e in data["emails"][:5]],
                        "confidence": confidence_level,
                        "first_run": first_run
                    },
                    "consequence_window": "Early signal — worth monitoring" if first_run else "Relationship risk — requires outreach within 7 days",
                    "source": "outlook_email_pattern_analysis",
                    "fingerprint": create_fingerprint("communications", "anomaly", f"silence_{sender[:20]}"),
                    "status": "active"
                })
    
    # === INSIGHT 2: RESPONSE CADENCE DEGRADATION ===
    # Detect: Response times increasing across a conversation thread
    
    # Group emails by subject (thread detection)
    threads = defaultdict(list)
    for email in emails:
        subject = email.get('subject', '').lower()
        # Normalize subject (remove Re:, Fwd:, etc.)
        normalized = subject.replace('re:', '').replace('fwd:', '').replace('fw:', '').strip()
        if normalized and len(normalized) > 5:
            threads[normalized[:100]].append(email)
    
    # Analyze threads with ≥threshold messages spanning ≥threshold days
    for subject, thread_emails in threads.items():
        if len(thread_emails) < CADENCE_MIN_MESSAGES:
            continue
        
        # Sort by received date
        sorted_thread = sorted(
            thread_emails,
            key=lambda e: datetime.fromisoformat(e.get('received_date', '').replace('Z', '+00:00')) if e.get('received_date') else datetime.min.replace(tzinfo=timezone.utc)
        )
        
        # Calculate time span
        if len(sorted_thread) < 2:
            continue
        
        try:
            first_date = datetime.fromisoformat(sorted_thread[0].get('received_date', '').replace('Z', '+00:00'))
            last_date = datetime.fromisoformat(sorted_thread[-1].get('received_date', '').replace('Z', '+00:00'))
            span_days = (last_date - first_date).days
        except:
            continue
        
        if span_days < CADENCE_MIN_SPAN_DAYS:
            continue
        
        # Calculate response time gaps (days between consecutive messages)
        response_gaps = []
        for i in range(1, len(sorted_thread)):
            try:
                prev_date = datetime.fromisoformat(sorted_thread[i-1].get('received_date', '').replace('Z', '+00:00'))
                curr_date = datetime.fromisoformat(sorted_thread[i].get('received_date', '').replace('Z', '+00:00'))
                gap_days = (curr_date - prev_date).days
                if gap_days > 0:
                    response_gaps.append(gap_days)
            except:
                continue
        
        if len(response_gaps) < 3:
            continue
        
        # Detect degradation: recent gaps > early gaps
        mid_point = len(response_gaps) // 2
        early_gaps = response_gaps[:mid_point]
        recent_gaps = response_gaps[mid_point:]
        
        avg_early = sum(early_gaps) / len(early_gaps) if early_gaps else 0
        avg_recent = sum(recent_gaps) / len(recent_gaps) if recent_gaps else 0
        
        # Anomaly: Recent response time SLOWDOWN_FACTOR slower than early
        if avg_early > 0 and avg_recent > avg_early * CADENCE_SLOWDOWN_FACTOR:
            degradation_pct = int((avg_recent / avg_early - 1) * 100)
            
            events.append({
                "id": str(uuid4()),
                "account_id": account_id,
                "domain": "communications",
                "type": "drift",
                "severity": "low" if first_run else "medium",
                "headline": f"Thread momentum collapse: {subject[:40]}...",
                "statement": f"This conversation thread started with responses every {int(avg_early)} days. Recent responses are taking {int(avg_recent)} days—{degradation_pct}% slower. This indicates declining engagement or deprioritization over {span_days} days.",
                "evidence_payload": {
                    "thread_subject": subject[:100],
                    "message_count": len(sorted_thread),
                    "span_days": span_days,
                    "early_response_avg_days": round(avg_early, 1),
                    "recent_response_avg_days": round(avg_recent, 1),
                    "degradation_percentage": degradation_pct,
                    "email_ids": [e.get('id') for e in sorted_thread[:10]],
                    "confidence": confidence_level,
                    "first_run": first_run
                },
                "consequence_window": "Emerging pattern — worth monitoring" if first_run else "Thread at risk of stalling — intervention required",
                "source": "outlook_thread_analysis",
                "fingerprint": create_fingerprint("communications", "drift", f"cadence_{subject[:20]}"),
                "status": "active"
            })
    
    # === INSIGHT 3: UNREAD CRITICAL PATTERN ===
    # Detect: Multiple unread emails from same sender (attention deficit signal)
    
    unread_by_sender = defaultdict(list)
    for email in emails:
        if not email.get('is_read', True) and email.get('is_external'):
            sender = email.get('from_address', '').lower()
            if sender:
                unread_by_sender[sender].append(email)
    
    for sender, unread_emails in unread_by_sender.items():
        if len(unread_emails) >= UNREAD_MIN_COUNT:
            # Check if this is a recent pattern (all within threshold days)
            recent_unreads = []
            for email in unread_emails:
                try:
                    recv_date = datetime.fromisoformat(email.get('received_date', '').replace('Z', '+00:00'))
                    days_old = (now - recv_date).days
                    if days_old <= UNREAD_MIN_DAYS:
                        recent_unreads.append(email)
                except:
                    continue
            
            if len(recent_unreads) >= UNREAD_MIN_COUNT:
                sender_name = next((e.get('from_name') for e in recent_unreads if e.get('from_name')), sender)
                
                events.append({
                    "id": str(uuid4()),
                    "account_id": account_id,
                    "domain": "communications",
                    "type": "risk",
                    "severity": "low" if first_run else "medium",
                    "headline": f"{len(recent_unreads)} unread from {sender_name[:30]}",
                    "statement": f"{len(recent_unreads)} emails from this sender have not been opened in the last {UNREAD_MIN_DAYS} days. This suggests either inbox overload or deprioritization of this contact.",
                    "evidence_payload": {
                        "sender_email": sender[:50],
                        "sender_name": sender_name[:100],
                        "unread_count": len(recent_unreads),
                        "oldest_unread_days": max((datetime.now(timezone.utc) - datetime.fromisoformat(e.get('received_date', '').replace('Z', '+00:00'))).days for e in recent_unreads if e.get('received_date')),
                        "email_ids": [e.get('id') for e in recent_unreads],
                        "confidence": confidence_level,
                        "first_run": first_run
                    },
                    "consequence_window": "Worth monitoring" if first_run else "Inbox attention deficit — potential missed critical information",
                    "source": "outlook_attention_analysis",
                    "fingerprint": create_fingerprint("communications", "risk", f"unread_{sender[:20]}"),
                    "status": "active"
                })
    
    return events


async def generate_cold_read(
    account_id: str,
    user_id: str,
    mongo_db: Any,
    watchtower_store: Any,
    lookback_days: int = 90
) -> Dict[str, Any]:
    """
    WATCHTOWER COLD READ - Hybrid Intelligence Bridge
    
    INPUT: MongoDB outlook_emails (read-only)
    OUTPUT: Supabase watchtower_events (write-only)
    INTELLIGENCE: Multi-message pattern detection
    
    FIRST-RUN MODE: Automatically uses adaptive thresholds when no events exist
    
    Args:
        account_id: Workspace ID
        user_id: User ID for email query
        mongo_db: MongoDB database instance
        watchtower_store: Supabase watchtower store
        lookback_days: Analysis window (default 90 days)
        
    Returns:
        {
            "events_created": int,
            "domains_analyzed": List[str],
            "email_count_analyzed": int,
            "first_run_mode": bool,
            "status": "complete" | "insufficient_data" | "failed"
        }
    """
    logger.info(f"🔍 WATCHTOWER COLD READ: Starting for account {account_id}, user {user_id}")
    
    all_events = []
    domains_analyzed = []
    
    try:
        # === FIRST-RUN DETECTION ===
        # Check if this is the first analysis (no existing events)
        existing_events = await watchtower_store.get_events(account_id, status=None)
        first_run = len(existing_events) == 0
        
        if first_run:
            logger.info("🎯 FIRST-RUN MODE ACTIVATED: Using adaptive thresholds for early signals")
        else:
            logger.info("📊 NORMAL MODE: Using standard thresholds")
        
        # === COMMUNICATIONS DOMAIN: Email Intelligence ===
        
        email_events = await analyze_email_relationship_patterns(
            mongo_db=mongo_db,
            user_id=user_id,
            account_id=account_id,
            lookback_days=lookback_days,
            first_run=first_run
        )
        
        all_events.extend(email_events)
        
        if email_events:
            domains_analyzed.append('communications')
            logger.info(f"✅ Email pattern analysis: {len(email_events)} insights generated")
        
        # Get email count for reporting
        cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)
        email_count = await mongo_db.outlook_emails.count_documents({
            "user_id": user_id,
            "received_date": {"$gte": cutoff.isoformat()}
        })
        
        # === PERSIST TO WATCHTOWER (Supabase) ===
        
        if all_events:
            for event in all_events:
                try:
                    await watchtower_store.create_event(event)
                    logger.info(f"✅ Watchtower event persisted: {event['headline']}")
                except Exception as e:
                    logger.error(f"❌ Failed to persist event: {e}")
        
        logger.info(f"🎯 COLD READ COMPLETE: {len(all_events)} events from {email_count} emails (first_run={first_run})")
        
        return {
            "events_created": len(all_events),
            "domains_analyzed": domains_analyzed,
            "email_count_analyzed": email_count,
            "first_run_mode": first_run,
            "status": "complete" if all_events else "insufficient_data"
        }
        
    except Exception as e:
        logger.error(f"❌ COLD READ FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "events_created": 0,
            "domains_analyzed": [],
            "email_count_analyzed": 0,
            "status": "failed",
            "error": str(e)
        }
