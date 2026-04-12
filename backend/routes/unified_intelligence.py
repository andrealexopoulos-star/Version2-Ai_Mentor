"""BIQc Unified Intelligence Engine — Cross-Integration Signal Surfacing.

Every page calls this engine. It fetches ALL integration data,
scores signals for relevance/risk, and returns page-specific intelligence.

This is the core of Cognition-as-a-Platform.
"""
import logging
import asyncio
import os
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from intelligence_live_truth import get_live_integration_truth, get_latest_snapshot_context, get_recent_observation_events
from supabase_client import init_supabase
from integration_snapshot_cache import get_snapshot, set_snapshot

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user

MERGE_HISTORY_PAGE_SIZE = int(os.environ.get("MERGE_HISTORY_PAGE_SIZE", "100"))
MERGE_HISTORY_MAX_PAGES = int(os.environ.get("MERGE_HISTORY_MAX_PAGES", "5"))


async def _fetch_merge_collection(
    merge_client: Any,
    method_name: str,
    account_token: str,
    *,
    page_size: int = MERGE_HISTORY_PAGE_SIZE,
    max_pages: int = MERGE_HISTORY_MAX_PAGES,
) -> Dict[str, Any]:
    """Cursor-crawl Merge collections for deeper history windows."""
    method = getattr(merge_client, method_name)
    cursor = None
    rows: List[Dict[str, Any]] = []
    pages_fetched = 0
    truncated = False

    for _ in range(max_pages):
        page = await method(account_token=account_token, cursor=cursor, page_size=page_size)
        pages_fetched += 1
        batch = page.get("results", []) or []
        rows.extend(batch)
        cursor = page.get("next")
        if not cursor or not batch:
            break
    if cursor:
        truncated = True

    return {
        "rows": rows,
        "pages_fetched": pages_fetched,
        "truncated": truncated,
        "next_cursor": cursor,
    }


def _collection_date_window(rows: List[Dict[str, Any]], keys: List[str]) -> Dict[str, Optional[str]]:
    dates: List[datetime] = []
    for row in rows:
        for key in keys:
            value = row.get(key)
            if not value:
                continue
            try:
                parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
                dates.append(parsed)
                break
            except Exception:
                continue
    if not dates:
        return {"start": None, "end": None}
    return {
        "start": min(dates).isoformat(),
        "end": max(dates).isoformat(),
    }


def _supabase_row_count(sb, table: str, user_id: str) -> Optional[int]:
    try:
        res = sb.table(table).select("id", count="exact").eq("user_id", user_id).limit(1).execute()
        val = getattr(res, "count", None)
        return int(val) if val is not None else 0
    except Exception as e:
        logger.debug(f"supabase count {table}: {e}")
        return None


def _fetch_supabase_paged(
    sb,
    user_id: str,
    *,
    table: str,
    order_column: str,
    select_columns: str,
    page_size: int,
    max_pages: int,
) -> Dict[str, Any]:
    """Paginate a user-scoped Supabase table; mirrors Merge page depth semantics."""
    total_count = _supabase_row_count(sb, table, user_id)
    rows: List[Dict[str, Any]] = []
    pages_fetched = 0
    offset = 0
    last_batch_len = 0
    try:
        for _ in range(max_pages):
            batch_res = (
                sb.table(table)
                .select(select_columns)
                .eq("user_id", user_id)
                .order(order_column, desc=True)
                .range(offset, offset + page_size - 1)
                .execute()
            )
            batch = batch_res.data or []
            if not batch:
                break
            pages_fetched += 1
            rows.extend(batch)
            last_batch_len = len(batch)
            if last_batch_len < page_size:
                break
            offset += page_size
    except Exception as e:
        logger.debug(f"supabase paged fetch {table}: {e}")

    truncated = False
    if total_count is not None and len(rows) < total_count:
        truncated = True
    elif pages_fetched >= max_pages and last_batch_len >= page_size:
        truncated = True

    return {
        "rows": rows,
        "pages_fetched": pages_fetched,
        "truncated": truncated,
        "total_count": total_count,
    }


async def _brain_page_summary(sb, current_user: dict, page_name: str) -> List[Dict[str, Any]]:
    try:
        from business_brain_engine import BusinessBrainEngine

        engine = BusinessBrainEngine(sb, current_user['id'], current_user)
        if not engine.business_core_ready:
            return []
        result = engine.get_priorities(recompute_metrics=False)

        concerns = result.get('concerns') or []
        if page_name == 'revenue':
            allowed = {'cashflow_risk', 'revenue_leakage', 'pipeline_stagnation', 'client_response_risk', 'concentration_risk', 'margin_compression'}
        else:
            allowed = {'cashflow_risk', 'client_response_risk', 'concentration_risk', 'operations_bottlenecks', 'margin_compression'}

        filtered = [item for item in concerns if item.get('concern_id') in allowed][:3]
        return [{
            'concern_id': item.get('concern_id'),
            'priority_score': item.get('priority_score'),
            'issue_brief': item.get('issue_brief') or item.get('explanation'),
            'why_now_brief': item.get('why_now_brief') or item.get('explanation'),
            'action_brief': item.get('action_brief') or item.get('recommendation'),
            'if_ignored_brief': item.get('if_ignored_brief') or item.get('explanation'),
            'fact_points': item.get('fact_points') or [],
            'source_summary': item.get('source_summary') or '',
            'confidence_note': item.get('confidence_note') or '',
            'outlook_30_60_90': item.get('outlook_30_60_90') or {},
            'repeat_count': item.get('repeat_count', 1),
            'last_seen': item.get('last_seen'),
            'escalation_state': item.get('escalation_state') or 'monitoring',
            'decision_label': item.get('decision_label') or item.get('name') or item.get('concern_id'),
        } for item in filtered]
    except Exception as e:
        logger.debug(f"Brain page summary unavailable for {page_name}: {e}")
        return []


def _safe_parse_iso(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except Exception:
        return None


def _build_data_contract(data: Dict[str, Any], page_name: str, *, lineage_extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    connected_sources = [
        key for key in ('crm', 'accounting', 'email', 'marketing')
        if data.get(key, {}).get('connected')
    ]
    has_snapshot = bool(data.get('snapshot'))
    live_signals = data.get('live_signals') or []
    has_live_signals = bool(live_signals)

    snapshot_generated_at = (data.get('snapshot') or {}).get('generated_at')
    latest_obs = None
    if has_live_signals:
        latest_obs = max(
            (_safe_parse_iso(evt.get('observed_at') or evt.get('created_at')) for evt in live_signals),
            default=None,
        )

    best_ts = latest_obs or _safe_parse_iso(snapshot_generated_at)
    freshness = 'unknown'
    if best_ts:
        minutes = int(max(0, (datetime.now(timezone.utc) - best_ts).total_seconds() // 60))
        freshness = f"{minutes}m" if minutes < 60 else f"{minutes // 60}h"

    source_count = len(connected_sources) + (1 if has_snapshot else 0) + (1 if has_live_signals else 0)
    confidence = 0.35 + (0.12 * len(connected_sources)) + (0.08 if has_snapshot else 0) + (0.08 if has_live_signals else 0)
    confidence = max(0.2, min(0.97, confidence))

    lineage = {
        'engine': 'unified_intelligence_v2',
        'page': page_name,
        'connected_sources': connected_sources,
        'snapshot_available': has_snapshot,
        'live_signals_count': len(live_signals),
        'cache_hit': bool((data.get('_cache') or {}).get('cache_hit')),
        'snapshot_generated_at': snapshot_generated_at,
        'last_observed_at': latest_obs.isoformat() if latest_obs else None,
    }
    if lineage_extra:
        lineage.update(lineage_extra)

    return {
        'confidence_score': round(confidence, 4),
        'data_sources_count': source_count,
        'data_freshness': freshness,
        'lineage': lineage,
    }


async def _fetch_all_integration_data(sb, user_id: str) -> Dict:
    """Fetch ALL data from ALL connected integrations in parallel."""
    cache_key = 'unified_integration_bundle_v2'
    cached = get_snapshot(sb, user_id, cache_key, max_age_minutes=10)
    if cached and isinstance(cached.get('payload'), dict):
        payload = cached.get('payload') or {}
        payload['_cache'] = {
            'cache_hit': True,
            'source_key': cache_key,
            'generated_at': cached.get('generated_at'),
        }
        return payload

    data = {
        'crm': {'connected': False, 'deals': [], 'contacts': [], 'companies': []},
        'accounting': {'connected': False, 'invoices': [], 'payments': [], 'balances': []},
        'email': {'connected': False, 'recent': [], 'response_times': [], 'history_meta': {}},
        'calendar': {'connected': False, 'events': [], 'history_meta': {}},
        'custom': {'connected': False, 'tickets': [], 'history_meta': {}},
        'marketing': {'connected': False, 'benchmarks': None},
        'profile': None,
        'snapshot': None,
        'live_signals': [],
        'coverage_window': {
            'crm': {"start": None, "end": None},
            'accounting': {"start": None, "end": None},
            'email': {"start": None, "end": None},
            'calendar': {"start": None, "end": None},
            'custom': {"start": None, "end": None},
        },
        '_cache': {'cache_hit': False, 'source_key': cache_key},
    }

    live_truth = get_live_integration_truth(sb, user_id)
    accounts = {
        row['category']: row for row in (live_truth.get('integrations') or [])
        if row.get('category') in {'crm', 'accounting', 'hris', 'ats', 'ticketing'}
        and (row.get('account_token') or row.get('merge_account_id'))
    }

    data['crm']['connected'] = live_truth.get('canonical_truth', {}).get('crm_connected', False)
    data['accounting']['connected'] = live_truth.get('canonical_truth', {}).get('accounting_connected', False)
    data['email']['connected'] = live_truth.get('canonical_truth', {}).get('email_connected', False)

    email_cache_count = _supabase_row_count(sb, "outlook_emails", user_id)
    if data['email']['connected'] or (email_cache_count or 0) > 0:
        email_pack = _fetch_supabase_paged(
            sb,
            user_id,
            table="outlook_emails",
            order_column="received_date",
            select_columns="received_date,sent_date,created_at,subject,provider,folder",
            page_size=MERGE_HISTORY_PAGE_SIZE,
            max_pages=MERGE_HISTORY_MAX_PAGES,
        )
        data['email']['history_meta'] = {
            "pages_fetched": email_pack.get("pages_fetched", 0),
            "rows_loaded": len(email_pack.get("rows") or []),
            "truncated": bool(email_pack.get("truncated")),
            "total_rows": email_pack.get("total_count"),
        }
        data['email']['recent'] = [
            {
                "subject": row.get("subject"),
                "received_date": row.get("received_date"),
                "folder": row.get("folder"),
            }
            for row in (email_pack.get("rows") or [])[:50]
        ]
        if email_pack.get("rows"):
            data['coverage_window']['email'] = _collection_date_window(
                email_pack["rows"],
                ["received_date", "sent_date", "created_at"],
            )

    cal_count = _supabase_row_count(sb, "outlook_calendar_events", user_id)
    data['calendar']['connected'] = bool(cal_count and cal_count > 0)
    if data['calendar']['connected']:
        cal_pack = _fetch_supabase_paged(
            sb,
            user_id,
            table="outlook_calendar_events",
            order_column="start_time",
            select_columns="start_time,end_time,created_at,subject,location",
            page_size=MERGE_HISTORY_PAGE_SIZE,
            max_pages=MERGE_HISTORY_MAX_PAGES,
        )
        data['calendar']['events'] = cal_pack.get("rows") or []
        data['calendar']['history_meta'] = {
            "pages_fetched": cal_pack.get("pages_fetched", 0),
            "rows_loaded": len(cal_pack.get("rows") or []),
            "truncated": bool(cal_pack.get("truncated")),
            "total_rows": cal_pack.get("total_count"),
        }
        if cal_pack.get("rows"):
            data['coverage_window']['calendar'] = _collection_date_window(
                cal_pack["rows"],
                ["start_time", "end_time", "created_at"],
            )

    # Get business profile
    try:
        profile = sb.table('business_profiles').select('*').eq('user_id', user_id).limit(1).execute()
        if profile.data:
            data['profile'] = profile.data[0]
    except Exception:
        pass

    # Get latest snapshot
    snapshot_context = get_latest_snapshot_context(sb, user_id)
    data['snapshot'] = snapshot_context.get('summary') or {}
    if snapshot_context.get('executive_memo') and isinstance(data['snapshot'], dict):
        data['snapshot']['executive_memo'] = snapshot_context['executive_memo']

    observation_state = get_recent_observation_events(sb, user_id, limit=25)
    data['live_signals'] = observation_state.get('events') or []

    # Fetch CRM data
    if 'crm' in accounts:
        try:
            from merge_client import MergeClient
            mc = MergeClient(merge_api_key=os.environ.get('MERGE_API_KEY', ''))
            token = accounts['crm']['account_token']
            deals = await _fetch_merge_collection(mc, "get_deals", token)
            contacts = await _fetch_merge_collection(mc, "get_contacts", token)
            data['crm']['deals'] = deals.get('rows', [])
            data['crm']['contacts'] = contacts.get('rows', [])
            data['crm']['history_meta'] = {
                "deals_pages_fetched": deals.get("pages_fetched", 0),
                "contacts_pages_fetched": contacts.get("pages_fetched", 0),
                "deals_rows_loaded": len(deals.get("rows") or []),
                "contacts_rows_loaded": len(contacts.get("rows") or []),
                "truncated": bool(deals.get("truncated") or contacts.get("truncated")),
            }
            data['coverage_window']['crm'] = _collection_date_window(
                data['crm']['deals'],
                ['close_date', 'last_modified_at', 'remote_updated_at', 'created_at', 'remote_created_at'],
            )
        except Exception as e:
            logger.debug(f"CRM fetch: {e}")

    # Fetch accounting data
    if 'accounting' in accounts:
        try:
            from merge_client import MergeClient
            mc = MergeClient(merge_api_key=os.environ.get('MERGE_API_KEY', ''))
            token = accounts['accounting']['account_token']
            invoices = await _fetch_merge_collection(mc, "get_invoices", token)
            payments = await _fetch_merge_collection(mc, "get_payments", token)
            data['accounting']['invoices'] = invoices.get('rows', [])
            data['accounting']['payments'] = payments.get('rows', [])
            data['accounting']['history_meta'] = {
                "invoices_pages_fetched": invoices.get("pages_fetched", 0),
                "payments_pages_fetched": payments.get("pages_fetched", 0),
                "invoices_rows_loaded": len(invoices.get("rows") or []),
                "payments_rows_loaded": len(payments.get("rows") or []),
                "truncated": bool(invoices.get("truncated") or payments.get("truncated")),
            }
            data['coverage_window']['accounting'] = _collection_date_window(
                data['accounting']['invoices'],
                ['issue_date', 'invoice_date', 'due_date', 'updated_at', 'remote_updated_at', 'created_at', 'remote_created_at'],
            )
        except Exception as e:
            logger.debug(f"Accounting fetch: {e}")

    if 'ticketing' in accounts:
        try:
            from merge_client import MergeClient
            mc = MergeClient(merge_api_key=os.environ.get('MERGE_API_KEY', ''))
            token = accounts['ticketing']['account_token']
            tickets = await _fetch_merge_collection(mc, "get_tickets", token)
            data['custom']['connected'] = True
            data['custom']['tickets'] = tickets.get('rows', [])
            data['custom']['history_meta'] = {
                "tickets_pages_fetched": tickets.get("pages_fetched", 0),
                "rows_loaded": len(tickets.get("rows") or []),
                "truncated": bool(tickets.get("truncated")),
            }
            if data['custom']['tickets']:
                data['coverage_window']['custom'] = _collection_date_window(
                    data['custom']['tickets'],
                    [
                        "due_date",
                        "remote_updated_at",
                        "updated_at",
                        "created_at",
                        "remote_created_at",
                        "completed_at",
                    ],
                )
        except Exception as e:
            logger.debug(f"Ticketing fetch: {e}")

    # Fetch marketing benchmarks
    try:
        bench = sb.table('marketing_benchmarks').select('scores, competitors, summary').eq('tenant_id', user_id).eq('is_current', True).execute()
        if bench.data:
            data['marketing']['connected'] = True
            data['marketing']['benchmarks'] = bench.data[0]
    except Exception:
        pass

    data_sources_count = sum(1 for k in ('crm', 'accounting', 'email', 'marketing') if data.get(k, {}).get('connected'))
    if data.get('snapshot'):
        data_sources_count += 1
    if data.get('live_signals'):
        data_sources_count += 1
    confidence = min(0.97, 0.35 + (0.1 * data_sources_count))
    set_snapshot(
        sb,
        user_id,
        cache_key,
        data,
        data_sources_count=data_sources_count,
        confidence_score=confidence,
        lineage={'engine': 'unified_intelligence_v2', 'source': 'live_fetch'},
        ttl_minutes=10,
    )
    return data


def _score_risk(value, thresholds: tuple) -> str:
    """Score a value as low/medium/high risk."""
    if value is None:
        return 'unknown'
    low, high = thresholds
    if value >= high:
        return 'high'
    if value >= low:
        return 'medium'
    return 'low'


def _compute_revenue_signals(data: Dict) -> Dict:
    """Extract revenue intelligence from ALL integrations."""
    signals = {'deals': [], 'pipeline_total': 0, 'stalled_deals': 0, 'at_risk': [],
               'won_count': 0, 'lost_count': 0, 'concentration_risk': 'low',
               'overdue_invoices': [], 'cash_signals': [], 'growth_signals': []}

    deals = data['crm'].get('deals', [])
    now = datetime.now(timezone.utc)

    for d in deals:
        amount = float(d.get('amount') or 0)
        status = (d.get('status') or '').upper()
        name = d.get('name', 'Unnamed')
        stage = d.get('stage', {}).get('name', '') if isinstance(d.get('stage'), dict) else str(d.get('stage', ''))
        last_mod = d.get('last_modified_at', '')

        signals['deals'].append({'name': name, 'amount': amount, 'status': status, 'stage': stage})

        if status == 'WON':
            signals['won_count'] += 1
        elif 'LOST' in status:
            signals['lost_count'] += 1
        else:
            signals['pipeline_total'] += amount
            # Stalled detection
            if last_mod:
                try:
                    mod_date = datetime.fromisoformat(last_mod.replace('Z', '+00:00'))
                    if (now - mod_date).days > 7:
                        signals['stalled_deals'] += 1
                        signals['at_risk'].append({'name': name, 'amount': amount, 'days_stalled': (now - mod_date).days, 'risk': 'Deal stalled — no activity'})
                except Exception:
                    pass

    # Concentration risk
    if deals:
        amounts = [float(d.get('amount') or 0) for d in deals if d.get('amount')]
        if amounts and max(amounts) > sum(amounts) * 0.4:
            signals['concentration_risk'] = 'high'
        elif amounts and max(amounts) > sum(amounts) * 0.25:
            signals['concentration_risk'] = 'medium'

    # Overdue invoices
    for inv in data['accounting'].get('invoices', []):
        due = inv.get('due_date', '')
        status = (inv.get('status') or '').lower()
        if due and 'paid' not in status:
            try:
                due_date = datetime.fromisoformat(due.replace('Z', '+00:00'))
                if due_date < now:
                    signals['overdue_invoices'].append({
                        'number': inv.get('number', '?'),
                        'amount': float(inv.get('total_amount') or 0),
                        'days_overdue': (now - due_date).days,
                        'risk': 'Invoice overdue',
                    })
            except Exception:
                pass

    return signals


def _compute_operations_signals(data: Dict) -> Dict:
    """Extract operations intelligence from ALL integrations."""
    signals = {'bottlenecks': [], 'capacity_alerts': [], 'sop_risks': [], 'team_signals': []}
    snapshot = data.get('snapshot', {}) or {}
    exec_data = snapshot.get('execution', {}) or {}

    if exec_data.get('bottleneck'):
        signals['bottlenecks'].append({'detail': exec_data['bottleneck'], 'source': 'cognitive_snapshot'})
    if exec_data.get('sla_breaches') and exec_data['sla_breaches'] > 0:
        signals['sop_risks'].append({'detail': f"{exec_data['sla_breaches']} SLA breaches detected", 'source': 'cognitive_snapshot'})

    # Deal velocity as operations signal
    deals = data['crm'].get('deals', [])
    stalled = [d for d in deals if d.get('last_modified_at') and (datetime.now(timezone.utc) - datetime.fromisoformat(d['last_modified_at'].replace('Z', '+00:00'))).days > 14]
    if stalled:
        signals['bottlenecks'].append({'detail': f"{len(stalled)} deals stalled >14 days — delivery pipeline friction", 'source': 'crm'})

    # Overdue invoices as ops signal
    overdue = [inv for inv in data['accounting'].get('invoices', []) if inv.get('due_date') and inv.get('status', '').lower() != 'paid']
    if overdue:
        signals['capacity_alerts'].append({'detail': f"{len(overdue)} invoices pending — cash flow ops risk", 'source': 'accounting'})

    for event in data.get('live_signals', []):
        signal_name = str(event.get('signal_name') or '')
        payload = event.get('signal_payload') or {}
        if signal_name in {'response_delay', 'thread_silence'}:
            hours = payload.get('response_delay_hours') or payload.get('silence_hours') or payload.get('hours')
            detail = payload.get('detail') or (
                f"{signal_name.replace('_', ' ').title()} detected" + (f" ({hours}h)" if hours else "")
            )
            signals['bottlenecks'].append({'detail': detail, 'source': event.get('source') or 'observation_events'})

    return signals


def _compute_risk_signals(data: Dict) -> Dict:
    """Extract risk intelligence from ALL integrations."""
    signals = {'financial_risks': [], 'operational_risks': [], 'people_risks': [],
               'market_risks': [], 'compliance_risks': [], 'overall_risk': 'low'}

    snapshot = data.get('snapshot', {}) or {}
    risk_data = snapshot.get('risk', {}) or {}
    capital = snapshot.get('capital', {}) or {}

    # Financial risk from accounting
    overdue_invoices = [inv for inv in data['accounting'].get('invoices', []) if inv.get('due_date') and inv.get('status', '').lower() != 'paid']
    total_overdue = sum(float(inv.get('total_amount', 0)) for inv in overdue_invoices)
    if total_overdue > 0:
        signals['financial_risks'].append({'detail': f"${total_overdue:,.0f} in overdue invoices", 'severity': 'high' if total_overdue > 10000 else 'medium', 'source': 'accounting'})

    if capital.get('runway') and capital['runway'] < 6:
        signals['financial_risks'].append({'detail': f"Cash runway: {capital['runway']} months", 'severity': 'high', 'source': 'cognitive_snapshot'})

    # Revenue concentration risk from CRM
    deals = data['crm'].get('deals', [])
    amounts = [float(d.get('amount') or 0) for d in deals if d.get('amount')]
    if amounts and max(amounts) > sum(amounts) * 0.4:
        signals['financial_risks'].append({'detail': 'Revenue concentration >40% in single client', 'severity': 'high', 'source': 'crm'})

    # Operational risk
    stalled = len([d for d in deals if d.get('last_modified_at') and (datetime.now(timezone.utc) - datetime.fromisoformat(d['last_modified_at'].replace('Z', '+00:00'))).days > 7])
    if stalled > 2:
        signals['operational_risks'].append({'detail': f"{stalled} deals stalled >7 days", 'severity': 'medium', 'source': 'crm'})

    for event in data.get('live_signals', []):
        signal_name = str(event.get('signal_name') or '')
        payload = event.get('signal_payload') or {}
        detail = payload.get('detail') or payload.get('message')
        if signal_name == 'thread_silence':
            signals['operational_risks'].append({
                'detail': detail or 'Active thread silence detected in recent client communication',
                'severity': 'high' if str(event.get('severity') or '').lower() in {'critical', 'high'} else 'medium',
                'source': event.get('source') or 'observation_events',
            })
        elif signal_name == 'response_delay':
            signals['people_risks'].append({
                'detail': detail or 'Customer response delay indicates execution pressure',
                'severity': 'medium',
                'source': event.get('source') or 'observation_events',
            })

    # People risk from snapshot
    vitals = snapshot.get('founder_vitals', {}) or {}
    if vitals.get('fatigue') == 'high':
        signals['people_risks'].append({'detail': 'Founder fatigue level: HIGH', 'severity': 'high', 'source': 'cognitive_snapshot'})
    if vitals.get('capacity_index') and vitals['capacity_index'] > 100:
        signals['people_risks'].append({'detail': f"Capacity utilisation: {vitals['capacity_index']}%", 'severity': 'high', 'source': 'cognitive_snapshot'})

    # Market risk from benchmarks
    bench = data['marketing'].get('benchmarks', {})
    if bench and bench.get('scores', {}).get('overall', 0) < 0.3:
        signals['market_risks'].append({'detail': f"Marketing score: {round(bench['scores']['overall'] * 100)}% — competitive visibility gap", 'severity': 'medium', 'source': 'marketing_benchmark'})

    # SPOFs from snapshot
    spofs = risk_data.get('spof', [])
    for spof in spofs:
        signals['people_risks'].append({'detail': spof, 'severity': 'high', 'source': 'cognitive_snapshot'})

    # Overall risk level
    high_count = sum(1 for cat in signals.values() if isinstance(cat, list) for item in cat if isinstance(item, dict) and item.get('severity') == 'high')
    signals['overall_risk'] = 'high' if high_count >= 2 else 'medium' if high_count >= 1 else 'low'

    return signals


def _compute_people_signals(data: Dict) -> Dict:
    """Extract people/workforce intelligence from ALL integrations."""
    signals = {'capacity': None, 'fatigue': None, 'calendar_density': None,
               'email_stress': None, 'team_risks': [], 'recommendations': []}

    snapshot = data.get('snapshot', {}) or {}
    vitals = snapshot.get('founder_vitals', {}) or {}

    signals['capacity'] = vitals.get('capacity_index')
    signals['fatigue'] = vitals.get('fatigue')
    signals['calendar_density'] = vitals.get('calendar')
    signals['email_stress'] = vitals.get('email_stress')

    if vitals.get('recommendation'):
        signals['recommendations'].append(vitals['recommendation'])

    # CRM engagement as people signal
    deals = data['crm'].get('deals', [])
    if deals:
        active = len([d for d in deals if (d.get('status') or '').upper() not in ('WON', 'LOST')])
        signals['team_risks'].append({'detail': f"{active} active deals requiring attention", 'source': 'crm'})

    for event in data.get('live_signals', []):
        signal_name = str(event.get('signal_name') or '')
        payload = event.get('signal_payload') or {}
        if signal_name == 'response_delay':
            signals['email_stress'] = payload.get('response_delay_hours') or payload.get('hours') or signals['email_stress']
            signals['team_risks'].append({
                'detail': payload.get('detail') or 'Response delays suggest overload in client-facing communication.',
                'source': event.get('source') or 'observation_events',
            })

    return signals


def _compute_market_signals(data: Dict) -> Dict:
    """Extract market intelligence from ALL integrations."""
    signals = {'positioning': None, 'competitors': [], 'benchmarks': {},
               'opportunities': [], 'threats': []}

    snapshot = data.get('snapshot', {}) or {}
    mi = snapshot.get('market_intelligence', {}) or {}
    market = snapshot.get('market', {}) or {}

    signals['positioning'] = mi.get('positioning_verdict')

    if market.get('competitors'):
        signals['competitors'] = market['competitors']
    if mi.get('probability_of_goal_achievement'):
        signals['benchmarks']['goal_probability'] = mi['probability_of_goal_achievement']
    if mi.get('misalignment_index'):
        signals['benchmarks']['misalignment'] = mi['misalignment_index']

    # Marketing benchmark data
    bench = data['marketing'].get('benchmarks', {})
    if bench and bench.get('scores'):
        signals['benchmarks']['marketing_scores'] = bench['scores']
        # Find weakest pillar
        scores = {k: v for k, v in bench['scores'].items() if k != 'overall' and isinstance(v, (int, float))}
        if scores:
            weakest = min(scores, key=scores.get)
            signals['threats'].append({'detail': f"Weakest marketing pillar: {weakest.replace('_', ' ').title()} ({round(scores[weakest] * 100)}%)", 'source': 'marketing_benchmark'})

    return signals


# ═══════════════════════════════════════════════════════════════
# PAGE-SPECIFIC INTELLIGENCE ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.get("/unified/advisor")
async def advisor_intelligence(current_user: dict = Depends(get_current_user)):
    """Unified intelligence for BIQc Overview — surfaces TOP signals across ALL integrations."""
    try:
        sb = init_supabase()
        data = await _fetch_all_integration_data(sb, current_user['id'])

        revenue = _compute_revenue_signals(data)
        risk = _compute_risk_signals(data)
        people = _compute_people_signals(data)
        market = _compute_market_signals(data)

        # Top alerts: highest severity items across ALL categories
        all_alerts = []
        for item in revenue.get('at_risk', []):
            all_alerts.append({**item, 'category': 'revenue'})
        for item in revenue.get('overdue_invoices', []):
            all_alerts.append({**item, 'category': 'money', 'severity': 'high'})
        for cat_name, cat_data in risk.items():
            if isinstance(cat_data, list):
                for item in cat_data:
                    if isinstance(item, dict):
                        all_alerts.append({**item, 'category': cat_name.replace('_risks', '')})

        seen_event_ids = set()
        deduped_alerts = []
        for alert in all_alerts:
            event_id = alert.get("event_id") or alert.get("id") or f"{alert.get('signal_name', '')}|{alert.get('source', '')}|{alert.get('entity', '')}"
            if event_id not in seen_event_ids:
                seen_event_ids.add(event_id)
                deduped_alerts.append(alert)
        all_alerts = deduped_alerts

        all_alerts.sort(key=lambda x: {'high': 0, 'medium': 1, 'low': 2}.get(x.get('severity', 'low'), 3))

        response = {
            'integrations': {
                'crm': data['crm']['connected'],
                'accounting': data['accounting']['connected'],
                'email': data['email']['connected'],
                'marketing': data['marketing']['connected'],
            },
            'top_alerts': all_alerts[:10],
            'revenue_summary': {
                'pipeline': revenue['pipeline_total'],
                'stalled': revenue['stalled_deals'],
                'concentration_risk': revenue['concentration_risk'],
                'overdue_count': len(revenue['overdue_invoices']),
            },
            'risk_level': risk['overall_risk'],
            'people': {'capacity': people['capacity'], 'fatigue': people['fatigue']},
            'market': {'positioning': market['positioning']},
        }
        response.update(_build_data_contract(data, 'advisor'))
        return response
    except Exception as e:
        logger.error(f"[unified/advisor] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unified/revenue")
async def revenue_intelligence(current_user: dict = Depends(get_current_user)):
    """Full revenue intelligence from CRM + accounting + marketing."""
    try:
        sb = init_supabase()
        data = await _fetch_all_integration_data(sb, current_user['id'])
        signals = _compute_revenue_signals(data)
        brain_summary = await _brain_page_summary(sb, current_user, 'revenue')
        response = {'connected': data['crm']['connected'] or data['accounting']['connected'], 'signals': signals, 'brain_summary': brain_summary}
        response.update(_build_data_contract(data, 'revenue', lineage_extra={'brain_summary_items': len(brain_summary)}))
        return response
    except Exception as e:
        logger.error(f"[unified/revenue] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unified/operations")
async def operations_intelligence(current_user: dict = Depends(get_current_user)):
    """Operations intelligence from CRM + accounting + snapshot."""
    try:
        sb = init_supabase()
        data = await _fetch_all_integration_data(sb, current_user['id'])
        signals = _compute_operations_signals(data)
        response = {'connected': data['crm']['connected'], 'signals': signals}
        response.update(_build_data_contract(data, 'operations'))
        return response
    except Exception as e:
        logger.error(f"[unified/operations] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unified/risk")
async def risk_intelligence(current_user: dict = Depends(get_current_user)):
    """Cross-department risk surfacing from ALL integrations."""
    try:
        sb = init_supabase()
        data = await _fetch_all_integration_data(sb, current_user['id'])
        signals = _compute_risk_signals(data)
        brain_summary = await _brain_page_summary(sb, current_user, 'risk')
        response = {'connected': any([data['crm']['connected'], data['accounting']['connected'], data['email']['connected']]), 'signals': signals, 'brain_summary': brain_summary}
        response.update(_build_data_contract(data, 'risk', lineage_extra={'brain_summary_items': len(brain_summary)}))
        return response
    except Exception as e:
        logger.error(f"[unified/risk] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unified/people")
async def people_intelligence(current_user: dict = Depends(get_current_user)):
    """Workforce intelligence from email + calendar + CRM."""
    try:
        sb = init_supabase()
        data = await _fetch_all_integration_data(sb, current_user['id'])
        signals = _compute_people_signals(data)
        response = {'connected': data['email']['connected'], 'signals': signals}
        response.update(_build_data_contract(data, 'people'))
        return response
    except Exception as e:
        logger.error(f"[unified/people] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unified/market")
async def market_intelligence_unified(current_user: dict = Depends(get_current_user)):
    """Market intelligence from scrape + benchmarks + snapshot."""
    try:
        sb = init_supabase()
        data = await _fetch_all_integration_data(sb, current_user['id'])
        signals = _compute_market_signals(data)
        response = {'connected': True, 'signals': signals}
        response.update(_build_data_contract(data, 'market'))
        return response
    except Exception as e:
        logger.error(f"[unified/market] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
