"""
BIQc Watchtower — Cold Read Intelligence Engine
PROMPT 2A FINAL - Hybrid Bridge Architecture

INPUT: email datastore (read-only)
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

from routes.deps import get_lookback_days, _normalize_subscription_tier

logger = logging.getLogger(__name__)


def create_fingerprint(domain: str, type: str, key: str) -> str:
    """Create stable deduplication fingerprint"""
    raw = f"{domain}:{type}:{key}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


async def analyze_email_relationship_patterns(
    email_store: Any,
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
    
    # Query outlook_emails (indexed on user_id)
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    
    cursor = email_store.outlook_emails.find(
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
        # ENHANCED: Validate with outbound attempts (Sent Items context)
        if avg_historical >= SILENCE_MIN_WEEKLY_EMAILS and recent_total == 0:
            last_seen_days = (now - data["last_seen"]).days if data["last_seen"] else 999
            
            if last_seen_days >= SILENCE_MIN_DAYS:
                # Check for outbound attempts (Sent Items context)
                # Query sent emails to this recipient
                outbound_cursor = email_store.outlook_emails.find(
                    {
                        "user_id": user_id,
                        "folder": "sent",
                        "to_recipients": {"$elemMatch": {"$regex": sender, "$options": "i"}},
                        "sent_date": {"$gte": (now - timedelta(days=last_seen_days)).isoformat()}
                    },
                    {"_id": 0, "id": 1, "sent_date": 1}
                ).limit(10)
                
                outbound_attempts = await outbound_cursor.to_list(length=10)
                outbound_count = len(outbound_attempts)
                
                # Signal strength: Silence + outbound attempts = Ghosting (stronger)
                #                 Silence + no attempts = Quiet (weaker)
                signal_strength = "ghosting_confirmed" if outbound_count >= 2 else "quiet_contact"
                
                # Get sender name for evidence
                sender_name = next((e.get('from_name') for e in data["emails"] if e.get('from_name')), sender)
                total_emails = len(data["emails"])
                
                events.append({
                    "id": str(uuid4()),
                    "account_id": account_id,
                    "domain": "communications",
                    "type": "anomaly",
                    "severity": "high" if (signal_strength == "ghosting_confirmed" and not first_run) else "medium",
                    "headline": f"Communication silence: {sender_name[:30]}" + (" (unresponsive)" if outbound_count >= 2 else ""),
                    "statement": f"This contact historically sent {int(avg_historical)} emails per week over the past 3 months. No communication received in the last {last_seen_days} days" + (f", despite {outbound_count} outbound attempts" if outbound_count > 0 else "") + f". This represents a {int((last_seen_days / 7) / avg_historical * 100)}% drop from normal cadence.",
                    "evidence_payload": {
                        "contact_email": sender[:50],
                        "contact_name": sender_name[:100],
                        "historical_avg_per_week": round(avg_historical, 1),
                        "silence_days": last_seen_days,
                        "total_historical_emails": total_emails,
                        "last_contact_date": data["last_seen"].isoformat() if data["last_seen"] else None,
                        "outbound_attempt_count": outbound_count,
                        "outbound_time_window_days": last_seen_days,
                        "signal_strength": signal_strength,
                        "analysis_period_days": lookback_days,
                        "email_ids_sample": [e.get('id') for e in data["emails"][:5]],
                        "confidence": confidence_level,
                        "first_run": first_run
                    },
                    "consequence_window": "Early signal — worth monitoring" if first_run else ("Relationship at risk — unresponsive despite outreach" if outbound_count >= 2 else "Relationship risk — requires outreach within 7 days"),
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
    
    # === INSIGHT 4: AFTER-HOURS BURNOUT PATTERN (Sent Items Context) ===
    # Detect: Emails sent outside standard business hours (11pm-5am pattern)
    # Uses: Sent Items metadata ONLY
    
    # Query sent items
    sent_cursor = email_store.outlook_emails.find(
        {
            "user_id": user_id,
            "folder": "sent",
            "sent_date": {"$exists": True}
        },
        {
            "_id": 0,
            "id": 1,
            "sent_date": 1,
            "to_recipients": 1,
            "subject": 1
        }
    ).limit(200)
    
    sent_emails = await sent_cursor.to_list(length=200)
    
    if len(sent_emails) >= 10:  # Need baseline
        after_hours_sends = []
        
        for email in sent_emails:
            sent_date_str = email.get('sent_date')
            if not sent_date_str:
                continue
            
            try:
                sent_dt = datetime.fromisoformat(sent_date_str.replace('Z', '+00:00'))
                hour = sent_dt.hour
                
                # After-hours: 11pm-5am (23:00-05:00)
                if hour >= 23 or hour <= 5:
                    after_hours_sends.append({
                        "id": email.get('id'),
                        "hour": hour,
                        "date": sent_dt.isoformat(),
                        "recipients_count": len(email.get('to_recipients', []))
                    })
            except:
                continue
        
        # Detect pattern: ≥3 after-hours sends in last 30 days
        thirty_days_ago = now - timedelta(days=30)
        recent_after_hours = [s for s in after_hours_sends 
                             if datetime.fromisoformat(s['date']) >= thirty_days_ago]
        
        if len(recent_after_hours) >= (2 if first_run else 3):
            # Calculate percentage
            recent_total = sum(1 for e in sent_emails 
                             if datetime.fromisoformat(e.get('sent_date', '').replace('Z', '+00:00')) >= thirty_days_ago)
            
            after_hours_pct = int((len(recent_after_hours) / recent_total * 100)) if recent_total > 0 else 0
            
            events.append({
                "id": str(uuid4()),
                "account_id": account_id,
                "domain": "communications",
                "type": "drift",
                "severity": "low",  # Always low (behavioral signal, not crisis)
                "headline": f"{len(recent_after_hours)} emails sent after-hours",
                "statement": f"{len(recent_after_hours)} emails were sent between 11pm and 5am in the last 30 days. This represents {after_hours_pct}% of total sent volume and may indicate workload pressure or timezone misalignment.",
                "evidence_payload": {
                    "after_hours_count": len(recent_after_hours),
                    "total_sent_30_days": recent_total,
                    "percentage": after_hours_pct,
                    "hour_distribution": Counter([s['hour'] for s in recent_after_hours]),
                    "sample_timestamps": [s['date'] for s in recent_after_hours[:5]],
                    "confidence": confidence_level,
                    "first_run": first_run
                },
                "consequence_window": "Emerging pattern — monitor for sustained after-hours activity" if first_run else "Workload pressure signal — assess capacity and boundaries",
                "source": "outlook_sent_pattern_analysis",
                "fingerprint": create_fingerprint("communications", "drift", "after_hours_burnout"),
                "status": "active"
            })
    
    return events


async def generate_cold_read(
    account_id: str,
    user_id: str,
    email_store: Any,
    watchtower_store: Any,
    lookback_days: int = 90,
    tier: str | None = None,
) -> Dict[str, Any]:
    """
    WATCHTOWER COLD READ - Hybrid Intelligence Bridge

    INPUT: outlook_emails datastore (read-only)
    OUTPUT: Supabase watchtower_events (write-only)
    INTELLIGENCE: Multi-message pattern detection

    FIRST-RUN MODE: Automatically uses adaptive thresholds when no events exist

    Args:
        account_id: Workspace ID
        user_id: User ID for email query
        email_store: datastore instance exposing outlook_emails access
        watchtower_store: Supabase watchtower store
        lookback_days: Analysis window (default 90 days). Overridden by tier
            when tier is supplied.
        tier: User subscription tier. When provided, lookback_days is derived
            from TIER_LOOKBACK_DAYS (deps.py) unless the caller passed an
            explicit value that differs from the default.

    Returns:
        {
            "events_created": int,
            "domains_analyzed": List[str],
            "email_count_analyzed": int,
            "first_run_mode": bool,
            "status": "complete" | "insufficient_data" | "failed"
        }
    """
    # Override lookback with tier-based value when tier is known and
    # the caller did not pass an explicit lookback_days override.
    if tier is not None and lookback_days == 90:
        tier_days = get_lookback_days(tier)
        if tier_days != -1:
            lookback_days = tier_days
        else:
            lookback_days = 3650  # ~10 years for unlimited tiers
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
            email_store=email_store,
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
        email_count = await email_store.outlook_emails.count_documents({
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
