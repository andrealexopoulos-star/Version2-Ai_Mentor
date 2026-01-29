# OUTLOOK SYNC ERROR - BACKEND ISSUE (OUT OF SCOPE)

## Issue Identified
**Error:** `/api/outlook/emails/sync` returns 400 Bad Request when user clicks "Refresh" button

## Evidence
From backend logs:
```
✅ Authenticated via Supabase: andre@thestrategysquad.com.au
INFO: 10.64.129.7:55064 - "GET /api/outlook/emails/sync HTTP/1.1" 400 Bad Request
```

## Analysis
1. **Authentication:** ✅ Working - User is authenticated
2. **OAuth Tokens:** ✅ Present - Tokens retrieved from database
3. **Token Expiry:** ✅ Valid - Expires 2026-01-28T10:45:41.815+00:00
4. **Endpoint:** ❌ FAILING - Returns 400 Bad Request

## Root Cause
The backend endpoint `/api/outlook/emails/sync` is returning a 400 error. Possible causes:
1. Missing or invalid request parameters
2. Backend validation failing
3. Microsoft Graph API call failing
4. Edge function timeout or error

## UI Stabilisation Status
✅ **COMPLETE** - This is a separate backend issue

The UI is working correctly:
- Error handling is in place (line 505 in Integrations.js)
- User sees error toast: "Sync failed: [error message]"
- Button shows loading state during sync
- No UI-related issues

## Scope Classification
- **UI Stabilisation (Phase 1):** ✅ COMPLETE
- **This Issue:** ❌ OUT OF SCOPE (Backend API Fix Required)

## Next Steps Required
1. Investigate backend `/api/outlook/emails/sync` endpoint
2. Check Microsoft Graph API call
3. Review backend error logs for detailed error message
4. Test email sync functionality end-to-end

## Recommendation
This requires a **backend troubleshooting session** with different constraints:
- Backend changes permitted
- API endpoint investigation
- Microsoft Graph API debugging
- Edge function review

**Do NOT proceed under "UI Stabilisation Only" constraints.**
