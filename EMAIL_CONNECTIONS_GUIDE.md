# EMAIL_CONNECTIONS TABLE - IMPLEMENTATION GUIDE

## SINGLE SOURCE OF TRUTH ARCHITECTURE

The email_connections table enforces ONE provider per user through PRIMARY KEY constraint.

## HOW EDGE FUNCTIONS USE IT

### outlook-auth Edge Function

After successful OAuth, upserts:
- provider = outlook (overwrites Gmail if was connected)
- connected = true
- Result: Only Outlook is active

### gmail_prod Edge Function

After successful OAuth, upserts:
- provider = gmail (overwrites Outlook if was connected)  
- connected = true
- Result: Only Gmail is active

## HOW FRONTEND USES IT

Single query to email_connections:
- Read provider field
- Read connected status
- Set UI state accordingly
- No conflicts possible

## DEPLOYMENT

Run SQL in Supabase SQL Editor, then update Edge Functions to write to this table.
