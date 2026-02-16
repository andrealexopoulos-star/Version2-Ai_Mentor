# PHASE 1 - CONNECTION TRUTH VERIFICATION

## GMAIL CONNECTION (Edge Function)

**Source of Truth:** `/functions/v1/gmail_prod` Edge Function

**Current Behavior:**
- ✅ Tokens stored in `gmail_connections` table (backend confirmed)
- ❌ Edge Function returning 401 (token validation failing)
- ⚠️ Integrations page calling Edge Function but getting errors
- ⚠️ Priority Inbox cannot detect Gmail (depends on Edge Function)

**Truth Driver:** Edge Function `gmail_prod`
- Uses: `supabaseAnon.auth.getUser(token)` for validation
- Returns: `{ ok: true, connected: true, inbox_type: "priority", labels_count: X }`

**UI Dependency:** Both Integrations.js and EmailInbox.js call this Edge Function

---

## OUTLOOK CONNECTION (Backend API)

**Source of Truth:** `GET /api/outlook/status` (backend endpoint)

**Current Behavior:**
- ✅ Returns 200 OK
- ✅ Uses `supabase_admin` to query `outlook_oauth_tokens`
- ✅ Integrations page successfully shows Outlook status

**Truth Driver:** Backend API with service role (bypasses RLS)

---

## INBOX TYPE DETECTION

**Gmail:** 
- Detected by: `gmail_prod` Edge Function
- Returns: `inbox_type: "priority"` or `"standard"`
- Based on: Gmail labels (CATEGORY_PRIMARY, IMPORTANT, etc.)

**Outlook:**
- Uses: Focused Inbox (backend)
- Not currently exposing inbox_type in same format

---

## ISSUE SUMMARY

**Gmail Truth:** ❌ BLOCKED
- Edge Function returns 401 instead of connection data
- Frontend cannot verify Gmail is connected
- Priority Inbox cannot detect Gmail

**Outlook Truth:** ✅ WORKING
- Backend API returns status successfully
- Frontend shows Outlook as connected

**Root Blocker:** Edge Function 401 authentication issue preventing Gmail truth from being accessible

**Decision:** MUST fix 401 before proceeding to intelligence pipeline
