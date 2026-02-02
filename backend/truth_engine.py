"""
BIQc Truth Engine — Cold Read Protocol v1
ONE-SHOT ANALYSIS of all connected systems

NOT a sync engine.
NOT a data warehouse.
NOT a mirror.

Fetches live data → Reasons → Emits Watchtower events → Done.
"""

import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)


def create_fingerprint(domain: str, type: str, key: str) -> str:
    """
    Create stable fingerprint for deduplication
    
    Args:
        domain: 'communications', 'pipeline', 'financial', etc.
        type: 'risk', 'drift', 'opportunity', 'anomaly'
        key: Unique identifier for this specific insight
        
    Returns:
        SHA256 hash (first 16 chars)
    """
    raw = f"{domain}:{type}:{key}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


async def analyze_communications_domain(
    account_id: str,
    email_data: Optional[Dict],
    calendar_data: Optional[Dict]
) -> List[Dict[str, Any]]:
    """
    Analyze email + calendar for communication risks
    
    Returns: List of watchtower events
    """
    events = []
    
    if not email_data and not calendar_data:
        return events
    
    # INSIGHT 1: Ghosted VIPs (high-value contacts with response drop)
    if email_data and email_data.get('high_priority'):
        high_priority_threads = email_data['high_priority']
        
        # Simple heuristic: threads older than 5 days with no resolution
        ghosted_count = sum(1 for t in high_priority_threads 
                           if t.get('days_old', 0) > 5 and not t.get('resolved', False))
        
        if ghosted_count >= 3:
            events.append({
                "id": str(uuid4()),
                "account_id": account_id,
                "domain": "communications",
                "type": "risk",
                "severity": "high" if ghosted_count >= 5 else "medium",
                "headline": f"{ghosted_count} high-priority conversations stalled",
                "statement": f"Based on the last 30 days, {ghosted_count} important email threads have been open for more than 5 days without resolution or response.",
                "evidence_payload": {
                    "stalled_count": ghosted_count,
                    "oldest_days": max((t.get('days_old', 0) for t in high_priority_threads), default=0),
                    "analysis_period_days": 30
                },
                "consequence_window": "Relationship risk within 7–14 days",
                "source": "outlook",
                "fingerprint": create_fingerprint("communications", "risk", "ghosted_vips"),
                "status": "active"
            })
    
    # INSIGHT 2: After-hours load (burnout risk)
    if calendar_data and calendar_data.get('events'):
        events_list = calendar_data['events']
        
        # Count meetings outside 8am-6pm
        after_hours = sum(1 for e in events_list 
                         if e.get('start_hour', 12) < 8 or e.get('start_hour', 12) > 18)
        
        total_events = len(events_list)
        
        if total_events > 0 and after_hours / total_events > 0.25:
            events.append({
                "account_id": account_id,
                "domain": "calendar",
                "type": "drift",
                "severity": "medium",
                "headline": "Meeting activity outside standard hours",
                "statement": f"{int(after_hours / total_events * 100)}% of meetings in the last 30 days occurred before 8am or after 6pm. This pattern suggests capacity constraints or timezone misalignment.",
                "evidence_payload": {
                    "after_hours_count": after_hours,
                    "total_meetings": total_events,
                    "percentage": round(after_hours / total_events * 100, 1)
                },
                "consequence_window": "Team sustainability risk",
                "source": "outlook_calendar",
                "fingerprint": create_fingerprint("calendar", "drift", "after_hours"),
                "status": "active"
            })
    
    # INSIGHT 3: Meeting density spike
    if calendar_data and calendar_data.get('events'):
        events_list = calendar_data['events']
        
        if len(events_list) > 60:  # More than 2/day average
            events.append({
                "account_id": account_id,
                "domain": "calendar",
                "type": "anomaly",
                "severity": "medium",
                "headline": "Meeting density increasing",
                "statement": f"{len(events_list)} meetings in the last 30 days. This reduces available execution time and may indicate coordination overhead.",
                "evidence_payload": {
                    "meeting_count": len(events_list),
                    "avg_per_day": round(len(events_list) / 30, 1),
                    "period_days": 30
                },
                "consequence_window": "Execution capacity constraint",
                "source": "outlook_calendar",
                "fingerprint": create_fingerprint("calendar", "anomaly", "meeting_density"),
                "status": "active"
            })
    
    return events


async def analyze_pipeline_domain(
    account_id: str,
    deals_data: Optional[Dict],
    merge_client: Any,
    account_token: str
) -> List[Dict[str, Any]]:
    """
    Analyze CRM pipeline for deal risks
    
    Returns: List of watchtower events
    """
    events = []
    
    if not deals_data or not deals_data.get('results'):
        return events
    
    deals = deals_data['results']
    
    # INSIGHT 1: Stalled deals (stage age > 30 days)
    stalled_deals = []
    for deal in deals:
        # Merge.dev unified model: check stage and last activity
        stage = deal.get('stage')
        updated_at = deal.get('modified_at') or deal.get('updated_at')
        
        if updated_at:
            try:
                updated_date = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                days_stale = (datetime.now(timezone.utc) - updated_date).days
                
                if days_stale > 30 and stage not in ['won', 'closed_won', 'lost', 'closed_lost']:
                    stalled_deals.append({
                        "name": deal.get('name', 'Unnamed'),
                        "stage": stage,
                        "days_stale": days_stale,
                        "amount": deal.get('amount')
                    })
            except:
                continue
    
    if len(stalled_deals) >= 3:
        total_stalled_value = sum(d.get('amount', 0) for d in stalled_deals if d.get('amount'))
        
        events.append({
            "account_id": account_id,
            "domain": "pipeline",
            "type": "risk",
            "severity": "high" if len(stalled_deals) >= 5 else "medium",
            "headline": f"{len(stalled_deals)} deals stalled for 30+ days",
            "statement": f"{len(stalled_deals)} open deals have had no activity for more than 30 days. This indicates pipeline friction or deal qualification issues.",
            "evidence_payload": {
                "stalled_count": len(stalled_deals),
                "oldest_days": max(d['days_stale'] for d in stalled_deals),
                "total_value": total_stalled_value,
                "stages_affected": list(set(d['stage'] for d in stalled_deals if d.get('stage')))
            },
            "consequence_window": "Revenue at risk if not addressed within 14 days",
            "source": "hubspot",
            "fingerprint": create_fingerprint("pipeline", "risk", "stalled_deals"),
            "status": "active"
        })
    
    # INSIGHT 2: Pipeline velocity drop
    recent_deals = [d for d in deals if d.get('created_at')]
    if len(recent_deals) > 0:
        try:
            # Sort by created date
            sorted_deals = sorted(
                recent_deals,
                key=lambda x: datetime.fromisoformat(x['created_at'].replace('Z', '+00:00')),
                reverse=True
            )
            
            # Compare last 30 days vs previous 30 days
            now = datetime.now(timezone.utc)
            last_30 = sum(1 for d in sorted_deals 
                         if (now - datetime.fromisoformat(d['created_at'].replace('Z', '+00:00'))).days <= 30)
            prev_30 = sum(1 for d in sorted_deals 
                         if 30 < (now - datetime.fromisoformat(d['created_at'].replace('Z', '+00:00'))).days <= 60)
            
            if prev_30 > 0 and last_30 < prev_30 * 0.7:  # 30% drop
                drop_pct = int((1 - last_30 / prev_30) * 100)
                
                events.append({
                    "account_id": account_id,
                    "domain": "pipeline",
                    "type": "drift",
                    "severity": "high" if drop_pct > 50 else "medium",
                    "headline": f"New deal creation down {drop_pct}%",
                    "statement": f"New deals created in the last 30 days ({last_30}) are {drop_pct}% lower than the previous 30 days ({prev_30}). This suggests pipeline generation issues.",
                    "evidence_payload": {
                        "last_30_days": last_30,
                        "prev_30_days": prev_30,
                        "drop_percentage": drop_pct,
                        "analysis_date": now.isoformat()
                    },
                    "consequence_window": "Revenue impact in 60–90 days",
                    "source": "hubspot",
                    "fingerprint": create_fingerprint("pipeline", "drift", "velocity_drop"),
                    "status": "active"
                })
        except:
            pass
    
    return events


async def analyze_financial_domain(
    account_id: str,
    invoices_data: Optional[Dict],
    payments_data: Optional[Dict]
) -> List[Dict[str, Any]]:
    """
    Analyze accounting data for cashflow risks
    
    Returns: List of watchtower events
    """
    events = []
    
    if not invoices_data or not invoices_data.get('results'):
        return events
    
    invoices = invoices_data['results']
    
    # INSIGHT 1: Overdue invoices
    now = datetime.now(timezone.utc)
    overdue_invoices = []
    
    for invoice in invoices:
        due_date_str = invoice.get('due_date')
        status = invoice.get('status', '').lower()
        
        if due_date_str and status in ['sent', 'partial', 'open', 'unpaid']:
            try:
                due_date = datetime.fromisoformat(due_date_str.replace('Z', '+00:00'))
                if due_date < now:
                    days_overdue = (now - due_date).days
                    overdue_invoices.append({
                        "invoice_id": invoice.get('id'),
                        "days_overdue": days_overdue,
                        "amount": invoice.get('total_amount', 0)
                    })
            except:
                continue
    
    if len(overdue_invoices) >= 3:
        total_overdue = sum(inv.get('amount', 0) for inv in overdue_invoices)
        avg_days = sum(inv['days_overdue'] for inv in overdue_invoices) / len(overdue_invoices)
        
        events.append({
            "account_id": account_id,
            "domain": "financial",
            "type": "risk",
            "severity": "critical" if len(overdue_invoices) >= 10 else "high",
            "headline": f"{len(overdue_invoices)} invoices overdue",
            "statement": f"{len(overdue_invoices)} invoices are past their due date, with an average delay of {int(avg_days)} days. This represents immediate cashflow pressure.",
            "evidence_payload": {
                "overdue_count": len(overdue_invoices),
                "total_amount_overdue": total_overdue,
                "avg_days_overdue": round(avg_days, 1),
                "oldest_days": max(inv['days_overdue'] for inv in overdue_invoices)
            },
            "consequence_window": "Cashflow impact: immediate",
            "source": "xero",
            "fingerprint": create_fingerprint("financial", "risk", "overdue_invoices"),
            "status": "active"
        })
    
    # INSIGHT 2: Payment term drift
    if len(invoices) > 10:
        # Calculate average days between issue and payment
        paid_invoices = [inv for inv in invoices if inv.get('status', '').lower() in ['paid', 'closed']]
        
        if len(paid_invoices) >= 5:
            payment_cycles = []
            for inv in paid_invoices:
                issue_date = inv.get('issue_date')
                paid_date = inv.get('paid_on_date') or inv.get('payment_date')
                
                if issue_date and paid_date:
                    try:
                        issue_dt = datetime.fromisoformat(issue_date.replace('Z', '+00:00'))
                        paid_dt = datetime.fromisoformat(paid_date.replace('Z', '+00:00'))
                        days_to_pay = (paid_dt - issue_dt).days
                        if 0 < days_to_pay < 180:  # Sanity check
                            payment_cycles.append(days_to_pay)
                    except:
                        continue
            
            if len(payment_cycles) >= 5:
                avg_payment_days = sum(payment_cycles) / len(payment_cycles)
                
                if avg_payment_days > 45:
                    events.append({
                        "account_id": account_id,
                        "domain": "financial",
                        "type": "drift",
                        "severity": "medium",
                        "headline": f"Payment cycles averaging {int(avg_payment_days)} days",
                        "statement": f"Invoices are taking an average of {int(avg_payment_days)} days to be paid. This is beyond standard 30-day terms and indicates payment term drift.",
                        "evidence_payload": {
                            "avg_payment_days": round(avg_payment_days, 1),
                            "sample_size": len(payment_cycles),
                            "longest_cycle": max(payment_cycles)
                        },
                        "consequence_window": "Cashflow planning risk",
                        "source": "xero",
                        "fingerprint": create_fingerprint("financial", "drift", "payment_terms"),
                        "status": "active"
                    })
    
    return events


async def analyze_pipeline_domain_full(
    account_id: str,
    deals_data: Optional[Dict],
    notes_data: Optional[Dict]
) -> List[Dict[str, Any]]:
    """
    Analyze CRM pipeline for deal risks
    
    Returns: List of watchtower events
    """
    events = []
    
    if not deals_data or not deals_data.get('results'):
        return events
    
    deals = deals_data['results']
    
    # INSIGHT 1: Stalled deals
    stalled = []
    for deal in deals:
        updated_at = deal.get('modified_at') or deal.get('updated_at')
        stage = deal.get('stage', {})
        stage_name = stage.get('name', '') if isinstance(stage, dict) else str(stage)
        
        if updated_at and stage_name.lower() not in ['won', 'closed won', 'lost', 'closed lost']:
            try:
                updated_date = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                days_stale = (datetime.now(timezone.utc) - updated_date).days
                
                if days_stale > 30:
                    stalled.append({
                        "id": deal.get('id'),
                        "days": days_stale,
                        "value": deal.get('amount', 0)
                    })
            except:
                continue
    
    if len(stalled) >= 3:
        events.append({
            "account_id": account_id,
            "domain": "pipeline",
            "type": "risk",
            "severity": "high" if len(stalled) >= 5 else "medium",
            "headline": f"{len(stalled)} deals inactive for 30+ days",
            "statement": f"{len(stalled)} open deals have had no updates in more than 30 days. This indicates stalled progression or poor pipeline hygiene.",
            "evidence_payload": {
                "stalled_count": len(stalled),
                "total_at_risk_value": sum(d['value'] for d in stalled),
                "oldest_days": max(d['days'] for d in stalled)
            },
            "consequence_window": "Revenue at risk within 30–60 days",
            "source": "hubspot",
            "fingerprint": create_fingerprint("pipeline", "risk", "stalled_deals"),
            "status": "active"
        })
    
    # INSIGHT 2: Pipeline concentration risk
    if len(deals) >= 5:
        deal_values = [d.get('amount', 0) for d in deals if d.get('amount', 0) > 0]
        
        if len(deal_values) >= 3:
            total_value = sum(deal_values)
            top_3_value = sum(sorted(deal_values, reverse=True)[:3])
            
            concentration_pct = (top_3_value / total_value * 100) if total_value > 0 else 0
            
            if concentration_pct > 60:
                events.append({
                    "account_id": account_id,
                    "domain": "pipeline",
                    "type": "risk",
                    "severity": "medium",
                    "headline": "Pipeline value concentrated in 3 deals",
                    "statement": f"{int(concentration_pct)}% of total pipeline value is concentrated in the top 3 deals. This creates revenue risk if any deal is lost.",
                    "evidence_payload": {
                        "concentration_percentage": round(concentration_pct, 1),
                        "top_3_value": top_3_value,
                        "total_pipeline_value": total_value,
                        "deal_count": len(deal_values)
                    },
                    "consequence_window": "Revenue volatility risk",
                    "source": "hubspot",
                    "fingerprint": create_fingerprint("pipeline", "risk", "concentration"),
                    "status": "active"
                })
    
    return events


async def generate_cold_read(
    account_id: str,
    supabase_admin: Any,
    merge_client: Any,
    watchtower_store: Any
) -> Dict[str, Any]:
    """
    ONE-SHOT COLD READ ANALYSIS
    
    Fetches live data from ALL connected systems
    Analyzes each domain
    Emits watchtower events
    
    Args:
        account_id: Workspace ID
        supabase_admin: Supabase admin client
        merge_client: Merge.dev client
        watchtower_store: Watchtower events store
        
    Returns:
        {
            "events_created": int,
            "domains_analyzed": List[str],
            "status": "complete" | "partial" | "failed"
        }
    """
    logger.info(f"🔍 COLD READ: Starting for account {account_id}")
    
    all_events = []
    domains_analyzed = []
    
    try:
        # Get account integrations
        integrations = supabase_admin.table("integration_accounts") \
            .select("*") \
            .eq("account_id", account_id) \
            .execute()
        
        if not integrations.data:
            logger.warning(f"No integrations found for account {account_id}")
            return {
                "events_created": 0,
                "domains_analyzed": [],
                "status": "complete"
            }
        
        integration_map = {row['category']: row for row in integrations.data}
        
        # Get user_id for this account (needed for email API calls)
        account_record = supabase_admin.table("accounts").select("*").eq("id", account_id).execute()
        if not account_record.data:
            logger.error(f"Account {account_id} not found")
            return {"events_created": 0, "domains_analyzed": [], "status": "failed"}
        
        # Get any user from this account
        users = supabase_admin.table("users").select("id").eq("account_id", account_id).limit(1).execute()
        if not users.data:
            logger.error(f"No users found for account {account_id}")
            return {"events_created": 0, "domains_analyzed": [], "status": "failed"}
        
        user_id = users.data[0]['id']
        
        # DOMAIN 1: COMMUNICATIONS (Email + Calendar)
        email_data = None
        calendar_data = None
        
        if 'email' in integration_map:
            try:
                # Fetch from email_priority_analysis collection (MongoDB)
                # This is populated by existing email sync
                from motor.motor_asyncio import AsyncIOMotorClient
                mongo_url = os.environ.get('MONGO_URL')
                mongo_client = AsyncIOMotorClient(mongo_url)
                mongo_db = mongo_client[os.environ.get('DB_NAME')]
                
                # Get latest email analysis
                email_analysis = await mongo_db.email_priority_analysis.find_one(
                    {"user_id": user_id},
                    sort=[("created_at", -1)]
                )
                
                if email_analysis:
                    email_data = email_analysis
                    logger.info("✅ Email data fetched from analysis collection")
            except Exception as e:
                logger.error(f"Email fetch failed: {e}")
        
        # Calendar events
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
            mongo_url = os.environ.get('MONGO_URL')
            mongo_client = AsyncIOMotorClient(mongo_url)
            mongo_db = mongo_client[os.environ.get('DB_NAME')]
            
            # Get recent calendar events (last 30 days)
            thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
            
            events_cursor = mongo_db.calendar_events.find(
                {
                    "user_id": user_id,
                    "start": {"$gte": thirty_days_ago.isoformat()}
                },
                {"_id": 0}
            ).limit(200)
            
            events_list = await events_cursor.to_list(length=200)
            
            if events_list:
                # Extract hour from start time
                for event in events_list:
                    try:
                        start_time = datetime.fromisoformat(event['start'].replace('Z', '+00:00'))
                        event['start_hour'] = start_time.hour
                    except:
                        event['start_hour'] = 12
                
                calendar_data = {"events": events_list}
                logger.info(f"✅ Calendar data fetched: {len(events_list)} events")
        except Exception as e:
            logger.debug(f"Calendar fetch skipped: {e}")
        
        comm_events = await analyze_communications_domain(account_id, email_data, calendar_data)
        all_events.extend(comm_events)
        if comm_events:
            domains_analyzed.append('communications')
        
        # DOMAIN 2: PIPELINE (CRM)
        if 'crm' in integration_map:
            crm_token = integration_map['crm'].get('account_token')
            
            if crm_token:
                try:
                    deals_data = await merge_client.get_deals(crm_token, page_size=100)
                    notes_data = None
                    
                    try:
                        notes_data = await merge_client.get_notes(crm_token, page_size=100)
                    except:
                        pass
                    
                    pipeline_events = await analyze_pipeline_domain_full(
                        account_id, deals_data, notes_data
                    )
                    all_events.extend(pipeline_events)
                    if pipeline_events:
                        domains_analyzed.append('pipeline')
                    
                    logger.info(f"✅ CRM analysis complete: {len(pipeline_events)} events")
                except Exception as e:
                    logger.error(f"CRM analysis failed: {e}")
        
        # DOMAIN 3: FINANCIAL (Accounting)
        if 'accounting' in integration_map:
            accounting_token = integration_map['accounting'].get('account_token')
            
            if accounting_token:
                try:
                    invoices_data = await merge_client.get_invoices(accounting_token, page_size=200)
                    payments_data = None
                    
                    try:
                        payments_data = await merge_client.get_payments(accounting_token, page_size=100)
                    except:
                        pass
                    
                    financial_events = await analyze_financial_domain(
                        account_id, invoices_data, payments_data
                    )
                    all_events.extend(financial_events)
                    if financial_events:
                        domains_analyzed.append('financial')
                    
                    logger.info(f"✅ Financial analysis complete: {len(financial_events)} events")
                except Exception as e:
                    logger.error(f"Financial analysis failed: {e}")
        
        # PERSIST TO WATCHTOWER
        if all_events:
            for event in all_events:
                try:
                    await watchtower_store.create_event(event)
                except Exception as e:
                    logger.error(f"Failed to persist event: {e}")
        
        logger.info(f"🎯 COLD READ COMPLETE: {len(all_events)} events across {len(domains_analyzed)} domains")
        
        return {
            "events_created": len(all_events),
            "domains_analyzed": domains_analyzed,
            "status": "complete"
        }
        
    except Exception as e:
        logger.error(f"❌ COLD READ FAILED: {str(e)}")
        return {
            "events_created": 0,
            "domains_analyzed": [],
            "status": "failed",
            "error": str(e)
        }
