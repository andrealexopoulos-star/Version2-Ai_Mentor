"""
CALENDAR INTELLIGENCE ENGINE — Meeting Analysis & Preparation

Analyzes calendar events to produce daily briefs, time allocation
breakdowns, and collaboration network maps.

INPUTS (read-only):
  - outlook_calendar_events
  - outlook_emails (for attendee context)
  - observation_events (domain=sales, for CRM context)

OUTPUTS (append/upsert):
  - calendar_intelligence
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)

# Keyword buckets for time-allocation categorisation
CATEGORY_KEYWORDS = {
    "standup":    ["standup", "stand-up", "daily sync", "daily check", "scrum"],
    "one_on_one": ["1:1", "1-1", "one on one", "1on1", "check-in", "checkin"],
    "client":     ["client", "customer", "account review", "qbr", "demo", "prospect"],
    "process":    ["sprint", "retro", "planning", "backlog", "refinement", "grooming"],
    "recruiting": ["interview", "recruiting", "candidate", "hiring", "debrief"],
    "all_hands":  ["all-hands", "all hands", "town hall", "company meeting", "all-team"],
}


class CalendarIntelligenceEngine:
    """
    Analyses calendar events for intelligence: daily briefs,
    time allocation, and collaboration networks.
    """

    def __init__(self, sb_client):
        self.sb = sb_client

    # ═══════════════════════════════════════════════════════════════
    # PUBLIC API
    # ═══════════════════════════════════════════════════════════════

    def generate_daily_brief(self, user_id: str) -> Dict[str, Any]:
        """
        Build a preparation brief for today's and tomorrow's meetings.

        For each meeting, enriches with:
          - Recent email context from each attendee (last 3)
          - CRM context from observation_events (domain=sales)
          - Generated prep notes

        Returns:
            {date, meetings[], total_meetings, total_meeting_hours,
             free_time_hours, summary}
        """
        try:
            now = datetime.now(timezone.utc)
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            tomorrow_end = (today_start + timedelta(days=2))

            # Fetch meetings in the two-day window
            result = (
                self.sb.table("outlook_calendar_events")
                .select("*")
                .eq("user_id", user_id)
                .gte("start_time", today_start.isoformat())
                .lt("start_time", tomorrow_end.isoformat())
                .order("start_time")
                .execute()
            )
            meetings_raw = result.data or []

            enriched_meetings = []
            total_minutes = 0

            for mtg in meetings_raw:
                duration = self._duration_minutes(
                    mtg.get("start_time"), mtg.get("end_time")
                )
                total_minutes += duration

                attendees = mtg.get("attendees") or []
                attendee_context = []
                for att in attendees[:10]:  # cap to avoid excessive queries
                    email_addr = att if isinstance(att, str) else att.get("email", "")
                    if not email_addr:
                        continue
                    ctx = self._get_attendee_email_context(user_id, email_addr)
                    if ctx:
                        attendee_context.append(ctx)

                crm_context = self._get_crm_context(user_id, mtg.get("subject", ""))

                prep_notes = self._build_prep_notes(
                    mtg, attendee_context, crm_context
                )

                enriched_meetings.append({
                    "id": mtg.get("id"),
                    "subject": mtg.get("subject", "(no subject)"),
                    "start_time": mtg.get("start_time"),
                    "end_time": mtg.get("end_time"),
                    "duration_minutes": duration,
                    "attendees": attendees,
                    "location": mtg.get("location"),
                    "attendee_context": attendee_context,
                    "crm_context": crm_context,
                    "prep_notes": prep_notes,
                })

            total_hours = round(total_minutes / 60, 1)
            # Assume an 8-hour working day
            free_time = max(0, round(8.0 - total_hours, 1))

            return {
                "date": now.strftime("%Y-%m-%d"),
                "meetings": enriched_meetings,
                "total_meetings": len(enriched_meetings),
                "total_meeting_hours": total_hours,
                "free_time_hours": free_time,
                "summary": (
                    f"{len(enriched_meetings)} meetings today/tomorrow "
                    f"({total_hours}h scheduled, {free_time}h free)."
                ),
            }

        except Exception as exc:
            logger.error("[calendar_intelligence] generate_daily_brief failed: %s", exc)
            return {
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "meetings": [],
                "total_meetings": 0,
                "total_meeting_hours": 0,
                "free_time_hours": 8.0,
                "summary": "Unable to generate daily brief.",
            }

    def analyze_time_allocation(
        self, user_id: str, days: int = 30
    ) -> Dict[str, Any]:
        """
        Categorise meetings over *days* into buckets (standups, 1:1s,
        client, process, recruiting, all-hands, other).

        Returns:
            {period_days, total_meetings, total_hours,
             avg_meetings_per_day, avg_hours_per_day, allocation{}}
        """
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

            result = (
                self.sb.table("outlook_calendar_events")
                .select("subject, start_time, end_time")
                .eq("user_id", user_id)
                .gte("start_time", cutoff)
                .execute()
            )
            events = result.data or []

            buckets: Dict[str, Dict[str, float]] = {}
            for cat in list(CATEGORY_KEYWORDS.keys()) + ["other"]:
                buckets[cat] = {"count": 0, "minutes": 0}

            for evt in events:
                duration = self._duration_minutes(
                    evt.get("start_time"), evt.get("end_time")
                )
                category = self._categorise_meeting(evt.get("subject", ""))
                buckets[category]["count"] += 1
                buckets[category]["minutes"] += duration

            total_meetings = sum(b["count"] for b in buckets.values())
            total_minutes = sum(b["minutes"] for b in buckets.values())
            total_hours = round(total_minutes / 60, 1)

            allocation = {}
            for cat, data in buckets.items():
                cat_hours = round(data["minutes"] / 60, 1)
                pct = round((data["count"] / total_meetings * 100), 1) if total_meetings else 0
                allocation[cat] = {
                    "count": int(data["count"]),
                    "hours": cat_hours,
                    "percentage": pct,
                }

            return {
                "period_days": days,
                "total_meetings": total_meetings,
                "total_hours": total_hours,
                "avg_meetings_per_day": round(total_meetings / max(days, 1), 1),
                "avg_hours_per_day": round(total_hours / max(days, 1), 1),
                "allocation": allocation,
            }

        except Exception as exc:
            logger.error("[calendar_intelligence] analyze_time_allocation failed: %s", exc)
            return {
                "period_days": days,
                "total_meetings": 0,
                "total_hours": 0,
                "avg_meetings_per_day": 0,
                "avg_hours_per_day": 0,
                "allocation": {},
            }

    def build_collaboration_network(
        self, user_id: str, days: int = 90
    ) -> Dict[str, Any]:
        """
        Count meeting frequency per attendee over the last *days*.
        Returns the top 20 collaborators.

        Returns:
            {period_days, total_unique_contacts, top_collaborators[]}
        """
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

            result = (
                self.sb.table("outlook_calendar_events")
                .select("attendees")
                .eq("user_id", user_id)
                .gte("start_time", cutoff)
                .execute()
            )
            events = result.data or []

            contact_counts: Dict[str, int] = {}
            for evt in events:
                attendees = evt.get("attendees") or []
                for att in attendees:
                    email = att if isinstance(att, str) else att.get("email", "")
                    if not email:
                        continue
                    email_lower = email.lower().strip()
                    contact_counts[email_lower] = contact_counts.get(email_lower, 0) + 1

            sorted_contacts = sorted(
                contact_counts.items(), key=lambda x: x[1], reverse=True
            )
            top_20 = [
                {"email": email, "meeting_count": count}
                for email, count in sorted_contacts[:20]
            ]

            return {
                "period_days": days,
                "total_unique_contacts": len(contact_counts),
                "top_collaborators": top_20,
            }

        except Exception as exc:
            logger.error("[calendar_intelligence] build_collaboration_network failed: %s", exc)
            return {
                "period_days": days,
                "total_unique_contacts": 0,
                "top_collaborators": [],
            }

    def store_intelligence(self, user_id: str) -> Dict[str, Any]:
        """
        Run all three analyses and persist to calendar_intelligence table.
        Uses insert with a dedup key (user_id + intelligence_date).
        """
        try:
            daily_brief = self.generate_daily_brief(user_id)
            time_alloc = self.analyze_time_allocation(user_id)
            collab_net = self.build_collaboration_network(user_id)

            today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

            payload = {
                "id": str(uuid4()),
                "user_id": user_id,
                "intelligence_date": today_str,
                "daily_brief": daily_brief,
                "time_allocation": time_alloc,
                "collaboration_network": collab_net,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

            # Upsert: if a row for this user + date already exists, replace it.
            # Requires a unique constraint on (user_id, intelligence_date).
            self.sb.table("calendar_intelligence").upsert(
                payload,
                on_conflict="user_id,intelligence_date",
            ).execute()

            logger.info(
                "[calendar_intelligence] Stored intelligence for user=%s date=%s",
                user_id, today_str,
            )
            return payload

        except Exception as exc:
            logger.error("[calendar_intelligence] store_intelligence failed: %s", exc)
            return {"error": str(exc)}

    # ═══════════════════════════════════════════════════════════════
    # HELPERS
    # ═══════════════════════════════════════════════════════════════

    def _duration_minutes(self, start: Optional[str], end: Optional[str]) -> float:
        """Parse ISO timestamps and return duration in minutes. Default 30."""
        if not start or not end:
            return 30.0
        try:
            s = datetime.fromisoformat(start.replace("Z", "+00:00"))
            e = datetime.fromisoformat(end.replace("Z", "+00:00"))
            diff = (e - s).total_seconds() / 60
            return diff if diff > 0 else 30.0
        except (ValueError, TypeError):
            return 30.0

    def _categorise_meeting(self, subject: str) -> str:
        """Map a meeting subject to a category bucket."""
        subject_lower = (subject or "").lower()
        for category, keywords in CATEGORY_KEYWORDS.items():
            for kw in keywords:
                if kw in subject_lower:
                    return category
        return "other"

    def _get_attendee_email_context(
        self, user_id: str, email_addr: str
    ) -> Optional[Dict[str, Any]]:
        """Fetch the last 3 emails involving *email_addr* for context."""
        try:
            result = (
                self.sb.table("outlook_emails")
                .select("subject, snippet, received_at, from_address")
                .eq("user_id", user_id)
                .or_(
                    f"from_address.eq.{email_addr},"
                    f"to_addresses.cs.{{{email_addr}}}"
                )
                .order("received_at", desc=True)
                .limit(3)
                .execute()
            )
            emails = result.data or []
            if not emails:
                return None
            return {
                "email": email_addr,
                "recent_emails": [
                    {
                        "subject": e.get("subject", ""),
                        "snippet": (e.get("snippet") or "")[:200],
                        "date": e.get("received_at"),
                    }
                    for e in emails
                ],
            }
        except Exception as exc:
            logger.debug(
                "[calendar_intelligence] email context lookup failed for %s: %s",
                email_addr, exc,
            )
            return None

    def _get_crm_context(
        self, user_id: str, meeting_subject: str
    ) -> Optional[Dict[str, Any]]:
        """Pull recent sales-domain observation events for CRM context."""
        try:
            result = (
                self.sb.table("observation_events")
                .select("signal_type, summary, severity, created_at")
                .eq("user_id", user_id)
                .eq("domain", "sales")
                .order("created_at", desc=True)
                .limit(5)
                .execute()
            )
            events = result.data or []
            if not events:
                return None
            return {
                "source": "observation_events",
                "domain": "sales",
                "recent_signals": [
                    {
                        "type": e.get("signal_type"),
                        "summary": (e.get("summary") or "")[:200],
                        "severity": e.get("severity"),
                        "date": e.get("created_at"),
                    }
                    for e in events
                ],
            }
        except Exception as exc:
            logger.debug(
                "[calendar_intelligence] CRM context lookup failed: %s", exc
            )
            return None

    def _build_prep_notes(
        self,
        meeting: Dict[str, Any],
        attendee_context: List[Dict],
        crm_context: Optional[Dict],
    ) -> str:
        """Generate plain-text preparation notes from enrichment data."""
        parts = []

        subject = meeting.get("subject", "(no subject)")
        parts.append(f"Meeting: {subject}")

        if attendee_context:
            parts.append(
                f"You have recent email threads with "
                f"{len(attendee_context)} attendee(s)."
            )
            for ctx in attendee_context[:3]:
                emails = ctx.get("recent_emails") or []
                if emails:
                    latest = emails[0]
                    parts.append(
                        f"  - {ctx['email']}: last email \"{latest.get('subject', '')}\""
                    )

        if crm_context:
            signals = crm_context.get("recent_signals") or []
            if signals:
                parts.append(
                    f"CRM: {len(signals)} recent sales signal(s) — "
                    f"latest: {signals[0].get('summary', 'N/A')}"
                )

        return "\n".join(parts) if parts else "No additional context available."
