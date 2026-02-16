# PHASE 5: EMAIL/CALENDAR SYNC MIGRATION
**Date:** 2025-01-20
**Objective:** Migrate Outlook email and calendar storage from MongoDB to Supabase
**Status:** IN PROGRESS

---

## CURRENT STATE ANALYSIS

### MongoDB Collections Used (Need Migration)
1. `outlook_emails` - Stores synced email data
2. `outlook_sync_jobs` - Tracks sync job status
3. `outlook_calendar` (potential - need to verify)
4. User tokens stored in MongoDB users collection (already migrated to m365_tokens)

### Backend Endpoints Using MongoDB
Need to find and migrate all endpoints that:
- Store emails in MongoDB
- Fetch emails from MongoDB
- Store calendar data in MongoDB
- Track sync jobs in MongoDB

---

## STEP 1: IDENTIFY ALL EMAIL/CALENDAR ENDPOINTS

Searching for endpoints that use MongoDB for email/calendar...
