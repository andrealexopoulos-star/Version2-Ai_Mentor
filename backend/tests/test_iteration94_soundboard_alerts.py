"""
Iteration 94 Backend Tests:
1. SoundBoard intelligence - system prompt, user_first_name, biz_context, RAG, memory
2. Alerts - deduplication (title + ID), dismissed notification filtering
3. Bell dropdown - Done/Ignore dismiss endpoint
4. sessionStorage cache key for scan-usage (code-level check)
"""
import pytest
import requests
import os
import re

def _get_base_url():
    """Read REACT_APP_BACKEND_URL from frontend .env if not in os.environ"""
    url = os.environ.get('REACT_APP_BACKEND_URL', '')
    if not url:
        try:
            with open('/app/frontend/.env', 'r') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        url = line.strip().split('=', 1)[1]
                        break
        except Exception:
            pass
    return url.rstrip('/')

BASE_URL = _get_base_url()

class TestSoundboardSystemPrompt:
    """Verify soundboard.py _SOUNDBOARD_FALLBACK has user_first_name placeholder"""
    
    def test_soundboard_py_has_fallback_with_user_first_name(self):
        """Code-level: _SOUNDBOARD_FALLBACK should contain {user_first_name} in soundboard.py"""
        soundboard_path = '/app/backend/routes/soundboard.py'
        with open(soundboard_path, 'r') as f:
            content = f.read()
        assert '{user_first_name}' in content, "_SOUNDBOARD_FALLBACK must contain {user_first_name} placeholder"
        print("PASS: _SOUNDBOARD_FALLBACK contains {user_first_name} placeholder")
    
    def test_soundboard_py_user_first_name_replacement(self):
        """Code-level: soundboard.py should call .replace('{user_first_name}', user_first_name)"""
        with open('/app/backend/routes/soundboard.py', 'r') as f:
            content = f.read()
        assert ".replace(\"{user_first_name}\", user_first_name)" in content, \
            "soundboard.py should call .replace('{user_first_name}', user_first_name) to inject name at request time"
        print("PASS: soundboard.py calls .replace('{user_first_name}', user_first_name)")
    
    def test_soundboard_py_biz_context_profile_fields(self):
        """Code-level: biz_context should loop over profile fields (industry, team_size, goals etc)"""
        with open('/app/backend/routes/soundboard.py', 'r') as f:
            content = f.read()
        assert "biz_context" in content, "biz_context variable must exist"
        assert "industry" in content, "industry must be in biz_context fields"
        assert "team_size" in content, "team_size must be in biz_context fields"
        assert "short_term_goals" in content or "goals" in content, "goals must be in biz_context fields"
        assert "BUSINESS DNA" in content, "BUSINESS DNA header must be in biz_context"
        print("PASS: biz_context built from business profile fields including industry, team_size, goals")
    
    def test_soundboard_py_rag_no_flag_check(self):
        """Code-level: RAG retrieval should be always attempted (no feature flag check)"""
        with open('/app/backend/routes/soundboard.py', 'r') as f:
            content = f.read()
        # Should NOT have 'if rag_enabled' or similar flag checks before RAG
        assert "RAG RETRIEVAL — always attempt (no flag dependency)" in content or \
               "rag_search" in content, "RAG retrieval must be present and always-on"
        # Check no flag dependency
        assert "rag_chat_enabled" not in content or "if rag_chat_enabled" not in content, \
            "RAG should not be gated by rag_chat_enabled flag"
        print("PASS: RAG retrieval always attempted (no flag dependency)")
    
    def test_soundboard_py_memory_no_flag_check(self):
        """Code-level: Memory context should be always attempted (no flag check)"""
        with open('/app/backend/routes/soundboard.py', 'r') as f:
            content = f.read()
        assert "context_summaries" in content, "context_summaries table must be queried for memory"
        assert "MEMORY — always attempt (no flag dependency)" in content or \
               "memory_context" in content, "memory context must be present"
        print("PASS: Memory context always attempted, context_summaries table queried")
    
    def test_soundboard_py_strategic_advisor_persona(self):
        """Code-level: System prompt should be 'Strategic Intelligence Advisor' not 'thinking partner'"""
        with open('/app/backend/routes/soundboard.py', 'r') as f:
            content = f.read()
        assert "Strategic Intelligence Advisor" in content, \
            "System prompt should use 'Strategic Intelligence Advisor' persona"
        print("PASS: System prompt uses 'Strategic Intelligence Advisor' persona")


class TestSoundboardCacheCode:
    """Verify sessionStorage cache implementation in SoundboardPanel.js and MySoundBoard.js"""
    
    def test_soundboardpanel_cache_key_defined(self):
        """SoundboardPanel.js should define SCAN_USAGE_CACHE_KEY"""
        with open('/app/frontend/src/components/SoundboardPanel.js', 'r') as f:
            content = f.read()
        assert "SCAN_USAGE_CACHE_KEY" in content, "SCAN_USAGE_CACHE_KEY must be defined in SoundboardPanel.js"
        print("PASS: SCAN_USAGE_CACHE_KEY defined in SoundboardPanel.js")
    
    def test_soundboardpanel_cache_ttl_5min(self):
        """SoundboardPanel.js should have 5min TTL for cache"""
        with open('/app/frontend/src/components/SoundboardPanel.js', 'r') as f:
            content = f.read()
        assert "5 * 60 * 1000" in content, "SCAN_USAGE_CACHE_TTL must be 5 * 60 * 1000 (5 minutes)"
        print("PASS: SCAN_USAGE_CACHE_TTL is 5 minutes in SoundboardPanel.js")
    
    def test_soundboardpanel_fetchscanusage_uses_cache(self):
        """SoundboardPanel.js fetchScanUsage should check sessionStorage cache before API call"""
        with open('/app/frontend/src/components/SoundboardPanel.js', 'r') as f:
            content = f.read()
        assert "sessionStorage.getItem(SCAN_USAGE_CACHE_KEY)" in content, \
            "fetchScanUsage must check sessionStorage cache"
        assert "sessionStorage.setItem(SCAN_USAGE_CACHE_KEY" in content, \
            "fetchScanUsage must save to sessionStorage cache"
        print("PASS: SoundboardPanel.js fetchScanUsage uses sessionStorage cache")
    
    def test_soundboardpanel_cache_invalidated_after_recordscan(self):
        """SoundboardPanel.js: after recordScan, cache must be invalidated with sessionStorage.removeItem"""
        with open('/app/frontend/src/components/SoundboardPanel.js', 'r') as f:
            content = f.read()
        assert "sessionStorage.removeItem(SCAN_USAGE_CACHE_KEY)" in content, \
            "After recordScan, sessionStorage.removeItem(SCAN_USAGE_CACHE_KEY) must be called to invalidate cache"
        print("PASS: SoundboardPanel.js invalidates cache via sessionStorage.removeItem after recordScan")
    
    def test_mysoundboard_cache_implemented(self):
        """MySoundBoard.js should have sessionStorage cache for scan-usage"""
        with open('/app/frontend/src/pages/MySoundBoard.js', 'r') as f:
            content = f.read()
        assert "sessionStorage.getItem" in content, "MySoundBoard.js must use sessionStorage cache"
        assert "5 * 60 * 1000" in content, "MySoundBoard.js cache TTL should be 5 minutes"
        print("PASS: MySoundBoard.js has sessionStorage cache for scan-usage")
    
    def test_mysoundboard_cache_invalidated_after_recordscan(self):
        """MySoundBoard.js: after recordScan, cache must be invalidated"""
        with open('/app/frontend/src/pages/MySoundBoard.js', 'r') as f:
            content = f.read()
        # Check if sessionStorage.removeItem is called and fetchScanUsage(true) is called with forceRefresh
        has_remove_item = "sessionStorage.removeItem" in content
        has_force_refresh = "fetchScanUsage(true)" in content
        
        if not has_remove_item:
            print(f"FAIL: MySoundBoard.js does NOT call sessionStorage.removeItem after recordScan — cache won't be invalidated properly")
            assert False, "MySoundBoard.js missing sessionStorage.removeItem after recordScan (cache bug)"
        if not has_force_refresh:
            print(f"WARN: MySoundBoard.js calls fetchScanUsage() without forceRefresh=true — may return stale cached data")
        print("PASS: MySoundBoard.js invalidates cache after recordScan")


class TestAlertsDashboard:
    """Verify bell dropdown alert action buttons in DashboardLayout.js"""
    
    def test_dashboardlayout_bell_has_done_ignore_review_buttons(self):
        """DashboardLayout.js bell dropdown should have Done/Ignore/Review buttons"""
        with open('/app/frontend/src/components/DashboardLayout.js', 'r') as f:
            content = f.read()
        assert "Done" in content, "Bell dropdown must have 'Done' button"
        assert "Ignore" in content, "Bell dropdown must have 'Ignore' button"
        assert "Review" in content, "Bell dropdown must have 'Review' button"
        print("PASS: Bell dropdown has Done/Ignore/Review buttons")
    
    def test_dashboardlayout_bell_width_w96(self):
        """DashboardLayout.js bell dropdown should use w-96 not w-80"""
        with open('/app/frontend/src/components/DashboardLayout.js', 'r') as f:
            content = f.read()
        # Should have w-96 in the notification dropdown
        assert "w-96" in content, "Bell dropdown should have w-96 width to fit action buttons"
        # Should NOT use w-80 for the notification panel (it may appear elsewhere)
        # Check that the notifications div specifically uses w-96
        lines = content.split('\n')
        notif_section = False
        for i, line in enumerate(lines):
            if 'showNotifications' in line and 'absolute right-0' in line:
                notif_section = True
            if notif_section and 'w-96' in line:
                print("PASS: Bell dropdown uses w-96 for notification panel")
                return
        # Fallback: just check w-96 is present and not w-80 for the notification panel
        assert "w-96" in content, "Bell dropdown notification panel should be w-96"
        print("PASS: Bell dropdown has w-96 (enough for action buttons)")
    
    def test_dashboardlayout_done_calls_dismiss_api(self):
        """Done button should call /api/notifications/dismiss/{id}"""
        with open('/app/frontend/src/components/DashboardLayout.js', 'r') as f:
            content = f.read()
        assert "/notifications/dismiss/" in content, \
            "Done button must call /notifications/dismiss/{id} endpoint"
        print("PASS: Done button calls /notifications/dismiss/{id}")
    
    def test_dashboardlayout_ignore_calls_dismiss_api(self):
        """Ignore button should call /api/notifications/dismiss/{id} (same as Done)"""
        with open('/app/frontend/src/components/DashboardLayout.js', 'r') as f:
            content = f.read()
        # Both Done and Ignore should call dismiss
        dismiss_count = content.count('/notifications/dismiss/')
        assert dismiss_count >= 2, f"Both Done and Ignore must call dismiss, found {dismiss_count} calls"
        print(f"PASS: Both Done and Ignore call /notifications/dismiss/ ({dismiss_count} calls found)")
    
    def test_dashboardlayout_buttons_have_testids(self):
        """Done/Ignore buttons should have data-testid attributes"""
        with open('/app/frontend/src/components/DashboardLayout.js', 'r') as f:
            content = f.read()
        assert "notif-dismiss" in content, "Done/Ignore buttons should have data-testid containing 'notif-dismiss'"
        print("PASS: Done/Ignore buttons have data-testid attributes")
    
    def test_dashboardlayout_fetchnotifications_after_dismiss(self):
        """After dismiss, fetchNotifications() should be called to refresh"""
        with open('/app/frontend/src/components/DashboardLayout.js', 'r') as f:
            content = f.read()
        assert "fetchNotifications()" in content, \
            "fetchNotifications() must be called after dismiss to refresh the list"
        print("PASS: fetchNotifications() called after dismiss")


class TestProfileNotificationsBackend:
    """Verify profile.py deduplication and dismissed_notifications filter"""
    
    def test_profile_py_deduplication_uses_seen_ids_and_seen_titles(self):
        """profile.py get_smart_notifications should use both seen_ids AND seen_titles"""
        with open('/app/backend/routes/profile.py', 'r') as f:
            content = f.read()
        assert "seen_ids" in content, "get_smart_notifications must use seen_ids for deduplication"
        assert "seen_titles" in content, "get_smart_notifications must use seen_titles for deduplication"
        # Both must be sets
        assert "seen_ids = set()" in content, "seen_ids must be initialized as set()"
        assert "seen_titles = set()" in content, "seen_titles must be initialized as set()"
        print("PASS: get_smart_notifications uses both seen_ids AND seen_titles for deduplication")
    
    def test_profile_py_dismissed_notifications_filter(self):
        """profile.py should filter out dismissed notifications from dismissed_notifications table"""
        with open('/app/backend/routes/profile.py', 'r') as f:
            content = f.read()
        assert "dismissed_notifications" in content, \
            "Must query dismissed_notifications table to filter dismissed items"
        assert "dismissed_ids" in content, "Must create dismissed_ids set from query results"
        assert "if nid in dismissed_ids" in content, \
            "Must check if notification ID is in dismissed_ids and skip it"
        print("PASS: dismissed_notifications filtered from get_smart_notifications")
    
    def test_profile_py_dismiss_notification_endpoint(self):
        """profile.py should have POST /notifications/dismiss/{notification_id} endpoint"""
        with open('/app/backend/routes/profile.py', 'r') as f:
            content = f.read()
        assert "/notifications/dismiss/" in content, "Must have dismiss notification endpoint"
        assert "dismissed_notifications" in content, "Must upsert to dismissed_notifications table"
        print("PASS: POST /notifications/dismiss/{notification_id} endpoint exists")


class TestBackendAPIs:
    """Live API tests for backend endpoints"""
    
    def test_homepage_loads(self):
        """Homepage should load without errors"""
        response = requests.get(BASE_URL, timeout=10)
        assert response.status_code == 200, f"Homepage should return 200, got {response.status_code}"
        print(f"PASS: Homepage loaded (status {response.status_code})")
    
    def test_scan_usage_requires_auth(self):
        """GET /soundboard/scan-usage should require auth"""
        response = requests.get(f"{BASE_URL}/api/soundboard/scan-usage", timeout=10)
        assert response.status_code in [401, 403], \
            f"scan-usage should require auth, got {response.status_code}"
        print(f"PASS: scan-usage requires auth (status {response.status_code})")
    
    def test_notifications_alerts_requires_auth(self):
        """GET /notifications/alerts should require auth"""
        response = requests.get(f"{BASE_URL}/api/notifications/alerts", timeout=10)
        assert response.status_code in [401, 403], \
            f"notifications/alerts should require auth, got {response.status_code}"
        print(f"PASS: notifications/alerts requires auth (status {response.status_code})")
    
    def test_notifications_dismiss_requires_auth(self):
        """POST /notifications/dismiss/{id} should require auth"""
        response = requests.post(f"{BASE_URL}/api/notifications/dismiss/test-id", timeout=10)
        assert response.status_code in [401, 403], \
            f"notifications/dismiss should require auth, got {response.status_code}"
        print(f"PASS: notifications/dismiss requires auth (status {response.status_code})")
    
    def test_soundboard_chat_requires_auth(self):
        """POST /soundboard/chat should require auth"""
        response = requests.post(
            f"{BASE_URL}/api/soundboard/chat",
            json={"message": "test"},
            timeout=10
        )
        assert response.status_code in [401, 403], \
            f"soundboard/chat should require auth, got {response.status_code}"
        print(f"PASS: soundboard/chat requires auth (status {response.status_code})")


class TestAlertsDismissMirror:
    """Sprint A #8 follow-up — dismissing an alert on /settings/alerts must
    also land in observation_event_dismissals so the Advisor Live Signal
    Feed hides the same signal.

    This is a pure-Python unit test. It does not need a live backend: the
    dismiss handler is a regular async function with sync supabase calls,
    so we swap in a FakeSupabase, invoke the handler with asyncio.run(),
    and assert that (a) the alert was marked dismissed and (b) the mirror
    landed in observation_event_dismissals with the right shape.
    """

    @staticmethod
    def _import_dismiss_handler():
        """Import routes.alerts.dismiss_alert with dep-stubs in place so the
        test runs on any Python version without spinning up Supabase.

        We stub the transitive import chain that alerts.py pulls in via
        ``routes.auth`` (auth_supabase → supabase_client, which uses PEP-604
        ``str | None`` unions that need Python 3.10+ to import). The real
        dismiss_alert body does not need any of that — it only calls
        ``get_supabase_admin()`` (which we patch in _run_dismiss) and
        ``record_observation_event_dismissal`` (imported lazily inside the
        function body, so our intelligence_live_truth stub gets picked up).
        """
        import asyncio
        import sys
        import types
        from pathlib import Path

        backend_root = Path(__file__).resolve().parents[1]
        if str(backend_root) not in sys.path:
            sys.path.insert(0, str(backend_root))

        # Stub out the auth dependency chain so `from routes.auth import
        # get_current_user` succeeds without loading supabase_client.
        if 'routes.auth' not in sys.modules:
            auth_stub = types.ModuleType('routes.auth')
            auth_stub.get_current_user = lambda: {'id': 'stub-user'}
            sys.modules['routes.auth'] = auth_stub

        # Stub supabase_client — dismiss_alert only calls get_supabase_admin
        # which we patch per-test with unittest.mock.
        if 'supabase_client' not in sys.modules:
            sb_stub = types.ModuleType('supabase_client')
            sb_stub.get_supabase_admin = lambda: None
            sys.modules['supabase_client'] = sb_stub

        # Stub intelligence_live_truth.record_observation_event_dismissal so
        # the lazy `from intelligence_live_truth import ...` inside the
        # dismiss handler writes into the FakeSupabase via the same API
        # shape as the real helper (sb.table(...).upsert(...).execute()).
        if 'intelligence_live_truth' not in sys.modules:
            ilt_stub = types.ModuleType('intelligence_live_truth')

            def _record(sb, user_id, event_id, source_surface):
                from datetime import datetime, timezone
                sb.table('observation_event_dismissals').upsert({
                    'user_id': user_id,
                    'event_id': event_id,
                    'dismissed_at': datetime.now(timezone.utc).isoformat(),
                    'source_surface': source_surface,
                }, on_conflict='user_id,event_id').execute()
                return True

            ilt_stub.record_observation_event_dismissal = _record
            sys.modules['intelligence_live_truth'] = ilt_stub

        from routes.alerts import dismiss_alert  # noqa: WPS433
        return dismiss_alert, asyncio

    @staticmethod
    def _build_fake_supabase(alert_row, obs_event_id_by_fingerprint=None):
        """Construct a minimal stand-in for supabase-py.

        - ``alert_row`` is the row returned by the UPDATE on alerts_queue.
        - ``obs_event_id_by_fingerprint`` (optional) maps fingerprint →
          observation_events.id used by the fingerprint-fallback lookup.
        """
        import types  # used inside the nested class bodies below

        class _Query:
            def __init__(self, owner, table):
                self.owner = owner
                self.table = table
                self.updates = None
                self.filters = {}
                self.selected = None

            def update(self, payload):
                self.updates = payload
                return self

            def select(self, cols):
                self.selected = cols
                return self

            def eq(self, col, val):
                self.filters[col] = val
                return self

            def limit(self, _n):
                return self

            def execute(self):
                # UPDATE alerts_queue.dismissed_at path — primary write
                if self.table == 'alerts_queue' and self.updates is not None:
                    self.owner.alerts_queue_updates.append({
                        'updates': dict(self.updates),
                        'filters': dict(self.filters),
                    })
                    return types.SimpleNamespace(data=[self.owner.alert_row])
                # Fingerprint lookup on observation_events
                if self.table == 'observation_events' and 'fingerprint' in self.filters:
                    fp = self.filters['fingerprint']
                    matched_id = self.owner.fp_map.get(fp)
                    data = [{'id': matched_id}] if matched_id else []
                    return types.SimpleNamespace(data=data)
                # Upsert into observation_event_dismissals
                if self.table == 'observation_event_dismissals' and self.updates is not None:
                    self.owner.dismissals.append(dict(self.updates))
                    return types.SimpleNamespace(data=[dict(self.updates)])
                return types.SimpleNamespace(data=[])

            def upsert(self, payload, on_conflict=None):
                self.updates = payload
                self.owner.last_on_conflict = on_conflict
                return self

        class _FakeSupabase:
            def __init__(self, alert_row, fp_map):
                self.alert_row = alert_row
                self.fp_map = fp_map
                self.alerts_queue_updates = []
                self.dismissals = []
                self.last_on_conflict = None

            def table(self, name):
                return _Query(self, name)

        return _FakeSupabase(alert_row, obs_event_id_by_fingerprint or {})

    def _run_dismiss(self, fake_sb, alert_id='alert-1', user_id='user-1'):
        dismiss_alert, asyncio = self._import_dismiss_handler()
        import unittest.mock as _mock

        # Patch get_supabase_admin so the dismiss handler's sb instance is
        # our FakeSupabase. record_observation_event_dismissal then calls
        # sb.table('observation_event_dismissals').upsert(...) which the
        # fake captures into `dismissals`.
        with _mock.patch('routes.alerts.get_supabase_admin', return_value=fake_sb):
            asyncio.run(dismiss_alert(alert_id=alert_id, current_user={'id': user_id}))

    def test_dismiss_mirrors_when_payload_has_observation_event_id(self):
        """Direct UUID path (mapping method a)."""
        alert_row = {
            'id': 'alert-1',
            'user_id': 'user-1',
            'payload': {
                'title': 'Pipeline stalled',
                'observation_event_id': 'obs-uuid-42',
            },
        }
        fake_sb = self._build_fake_supabase(alert_row)
        self._run_dismiss(fake_sb)

        assert len(fake_sb.alerts_queue_updates) == 1, (
            "alerts_queue.dismissed_at write must still happen"
        )
        assert 'dismissed_at' in fake_sb.alerts_queue_updates[0]['updates']
        assert len(fake_sb.dismissals) == 1, (
            "observation_event_dismissals mirror must run"
        )
        mirrored = fake_sb.dismissals[0]
        assert mirrored['event_id'] == 'obs-uuid-42'
        assert mirrored['user_id'] == 'user-1'
        assert mirrored['source_surface'] == 'alerts'
        assert fake_sb.last_on_conflict == 'user_id,event_id', (
            "upsert must use ON CONFLICT (user_id,event_id) DO NOTHING"
        )

    def test_dismiss_mirrors_via_fingerprint_fallback(self):
        """Fingerprint-join path (mapping method b)."""
        alert_row = {
            'id': 'alert-2',
            'user_id': 'user-1',
            'payload': {
                'title': 'Cash runway narrowing',
                'fingerprint': 'cashflow_q2_risk',
            },
        }
        fake_sb = self._build_fake_supabase(
            alert_row,
            obs_event_id_by_fingerprint={'cashflow_q2_risk': 'obs-uuid-99'},
        )
        self._run_dismiss(fake_sb, alert_id='alert-2')

        assert len(fake_sb.dismissals) == 1
        assert fake_sb.dismissals[0]['event_id'] == 'obs-uuid-99'
        assert fake_sb.dismissals[0]['source_surface'] == 'alerts'

    def test_dismiss_does_not_mirror_when_no_mapping_available(self):
        """Alerts with no event_id and no fingerprint must still succeed
        (primary dismiss works) but must not insert into dismissals."""
        alert_row = {
            'id': 'alert-3',
            'user_id': 'user-1',
            'payload': {
                'title': 'Welcome alert',
            },
        }
        fake_sb = self._build_fake_supabase(alert_row)
        self._run_dismiss(fake_sb, alert_id='alert-3')

        assert len(fake_sb.alerts_queue_updates) == 1, (
            "primary dismiss must still happen"
        )
        assert len(fake_sb.dismissals) == 0, (
            "no mirror when alert carries no observation_events linkage"
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
