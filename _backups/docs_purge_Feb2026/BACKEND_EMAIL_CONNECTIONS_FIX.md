# BACKEND OAUTH EMAIL_CONNECTIONS FIX - COMPLETE

## ROOT CAUSE (Via Triage Agent)

**Problem:** Backend OAuth callbacks store tokens but DON'T write to email_connections

**Impact:** Frontend checks email_connections, finds nothing, shows "No email provider connected"

**Architecture Mismatch:**
- Backend OAuth = Entry point for NEW connections (was missing email_connections write)
- Edge Functions = Status checks only (have email_connections write, but not called during OAuth)

---

## FIX APPLIED

### Files Modified: 1

**File:** `/app/backend/server.py`

**Change 1: Outlook Callback (Line ~2853)**
Added after `store_outlook_tokens`:
```python
supabase_admin.table("email_connections").upsert({
    "user_id": user_id,
    "provider": "outlook",
    "connected": True,
    "connected_email": microsoft_email,
    "inbox_type": "standard",
    "connected_at": datetime.now(timezone.utc).isoformat(),
    "last_sync_at": datetime.now(timezone.utc).isoformat(),
    "sync_status": "active"
}, on_conflict="user_id").execute()
```

**Change 2: Gmail Callback (Line ~2732)**
Added after `gmail_connections` upsert:
```python
supabase_admin.table("email_connections").upsert({
    "user_id": user_id,
    "provider": "gmail",
    "connected": True,
    "connected_email": google_email,
    "inbox_type": "standard",
    "connected_at": datetime.now(timezone.utc).isoformat(),
    "last_sync_at": datetime.now(timezone.utc).isoformat(),
    "sync_status": "active"
}, on_conflict="user_id").execute()
```

---

## POST-CHECKS

✅ **Backend restarted:** Successfully
✅ **Health check:** Passing
✅ **Both callbacks updated:** Outlook + Gmail

### Testing Required:

**Test 1: Reconnect Outlook**
1. If currently connected, disconnect Outlook first
2. Navigate to /connect-email
3. Click "Connect Outlook"
4. Complete Microsoft OAuth
5. **Check backend logs:**
   ```
   Expected: "💾 Writing to email_connections (canonical source)..."
   Expected: "✅ email_connections upserted - Outlook is now the active provider"
   ```

**Test 2: Verify Database**
```sql
SELECT * FROM email_connections WHERE user_id = '[your-user-id]';
```
**Expected:** Row with provider='outlook', connected=true

**Test 3: UI Shows Connected**
1. After OAuth completes
2. Navigate to /connect-email
3. **Expected:** Outlook card shows green border + "Connected"
4. **NOT expected:** "No email provider connected"

---

## ROLLBACK

**Remove email_connections upserts from both callbacks:**

Line ~2853 (Outlook):
```python
# Remove the email_connections upsert block
```

Line ~2732 (Gmail):
```python
# Remove the email_connections upsert block
```

---

## SUMMARY

**Problem:** OAuth callbacks didn't write to canonical table
**Fix:** Both callbacks now write to email_connections after storing tokens
**Impact:** Frontend will now detect connections immediately after OAuth

**Files Modified:** 1
- `/app/backend/server.py` (2 callbacks updated)

**Risk:** LOW - Adding write, not changing existing logic

---

**TEST BY RECONNECTING OUTLOOK OR GMAIL**
