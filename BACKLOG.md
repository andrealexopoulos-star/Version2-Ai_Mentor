# BIQC Application Backlog
**Last Updated:** January 22, 2025

---

## ✅ COMPLETED (This Session)

| Item | Description | Status |
|------|-------------|--------|
| Auth Redirect Loop | Fixed login loop on mobile | ✅ Done |
| Azure Client ID | Restored correct Client ID from `auth-revival-11` to `5d6e3cbb-cd88-4694-aa19-9b7115666866` | ✅ Done |
| Outlook OAuth Flow | Updated to use Supabase Edge Function | ✅ Done |
| Backend Token Reading | Updated to read from `outlook_oauth_tokens` table | ✅ Done |
| Supabase URL Config | Updated `POST_AUTH_REDIRECT` in Edge Function | ✅ Done |
| Outlook Connection | Microsoft Outlook now connects successfully | ✅ Done |

---

## 🔴 P0 - CRITICAL (Investor Demo)

| Item | Description | Dependencies | Effort |
|------|-------------|--------------|--------|
| **Priority Inbox** | Emails sync after Outlook connection but Priority Inbox page needs to display prioritized emails | Outlook ✅ | Medium |
| Email Sync Verification | Verify emails are being synced to `outlook_emails` table after connection | Outlook ✅ | Small |
| Email AI Analysis | Ensure `/email/analyze-priority` runs on synced emails | Email Sync | Medium |

---

## 🟠 P1 - HIGH PRIORITY

| Item | Description | Dependencies | Effort |
|------|-------------|--------------|--------|
| **New User Signup** | Verify new user registration creates proper records in `users` and `onboarding` tables | None | Medium |
| **Notifications Endpoint** | Fix 500 errors on `/api/notifications/alerts` | None | Small |
| Google Calendar Integration | Connect Google Calendar for meeting insights | Supabase Auth ✅ | Large |
| Gmail Integration | Connect Gmail for additional email intelligence | Supabase Auth ✅ | Large |

---

## 🟡 P2 - MEDIUM PRIORITY

| Item | Description | Dependencies | Effort |
|------|-------------|--------------|--------|
| Theme Toggle | Fix non-functional dark/light mode toggle in `DashboardLayout.js` | None | Small |
| Password Reset | Implement password reset flow via Supabase | None | Medium |
| 2FA / Two-Factor Auth | Add optional 2FA for enhanced security | Password Reset | Large |
| Calendar View Enhancement | Improve calendar display with Outlook events | Outlook ✅ | Medium |

---

## 🔵 P3 - BACKLOG / FUTURE

| Item | Description | Dependencies | Effort |
|------|-------------|--------------|--------|
| Serper.dev Integration | Pull live external data into Cognitive Core | API Key | Large |
| PWA Finalization | Add app icons to `manifest.json` for mobile install | None | Small |
| Backend Refactoring | Break down monolithic `server.py` into routes/services/models | None | Large |
| BIQC Meta-Layer | Track beliefs, decision outcomes, and drift | Core Features | X-Large |
| Mobile CSS Cleanup | Audit and consolidate mobile CSS files (remove `!important` overrides) | None | Medium |
| HubSpot Integration | Sync CRM contacts and deals | Pro Feature | Large |
| Salesforce Integration | Sync CRM data and pipeline | Pro Feature | Large |
| Xero Integration | Financial data and accounting insights | Pro Feature | Large |
| QuickBooks Integration | Bookkeeping and financial reports | Pro Feature | Large |

---

## 🐛 KNOWN ISSUES

| Issue | Location | Severity | Notes |
|-------|----------|----------|-------|
| Theme toggle doesn't work | `DashboardLayout.js` | Low | onClick handler issue |
| Mobile CSS conflicts | `mobile-dashboard.css`, `mobile-enhancements.css` | Low | Use Tailwind responsive prefixes instead |
| Notifications 500 error | `/api/notifications/alerts` | Medium | TypeError similar to fixed endpoints |

---

## 📁 KEY FILES REFERENCE

**Backend:**
- `/app/backend/server.py` - Main FastAPI app (monolith)
- `/app/backend/auth_supabase.py` - Supabase auth helpers
- `/app/backend/supabase_client.py` - Supabase admin client
- `/app/backend/.env` - Environment variables

**Frontend:**
- `/app/frontend/src/App.js` - Main router
- `/app/frontend/src/context/SupabaseAuthContext.js` - Auth context
- `/app/frontend/src/pages/Integrations.js` - Outlook connection
- `/app/frontend/src/pages/EmailInbox.js` - Priority Inbox UI
- `/app/frontend/src/pages/Advisor.js` - Main advisor chat
- `/app/frontend/src/components/DashboardLayout.js` - Layout & navigation

**Supabase:**
- Edge Function: `outlook-auth` - Handles Microsoft OAuth flow
- Tables: `users`, `onboarding`, `outlook_oauth_tokens`, `outlook_emails`

---

## 🔑 CREDENTIALS

**Test Account:**
- Email: `testing@biqc.demo`
- Password: `TestPass123!`

**Azure App Registration:**
- Client ID: `5d6e3cbb-cd88-4694-aa19-9b7115666866`

**Supabase Project:**
- URL: `https://uxyqpdfftxpkzeppqtvk.supabase.co`

---

## 📝 NOTES

1. **Investor Demo Priority**: Focus on Priority Inbox working end-to-end
2. **Supabase Edge Functions**: Outlook OAuth handled by Edge Function, not backend
3. **Token Storage**: Outlook tokens stored in `outlook_oauth_tokens` table
4. **URL Migration**: All URLs now use `advisor-chat-1.preview.emergentagent.com`
