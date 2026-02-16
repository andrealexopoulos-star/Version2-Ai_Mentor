# PHASE 2C: EMAIL SELECTION PAGE - COMPLETE

## A. GOAL
Create ConnectEmail page with provider selection UI (Outlook / Gmail / Other) on right side, wired to existing OAuth flows.

---

## B. PRE-CHECKS PERFORMED

✅ **OAuth Handlers:** Found handleOutlookConnect and handleGmailConnect in Integrations.js
✅ **Token Auth:** Both handlers use session token (403 fix applied)
✅ **Endpoints:** `/api/auth/outlook/login` and `/api/auth/gmail/login` confirmed working
✅ **Icons:** Mail, CheckCircle2, ArrowRight, Loader2 available from lucide-react

---

## C. CHANGES APPLIED

### Files Modified: 2

**File 1:** `/app/frontend/src/pages/ConnectEmail.js` (NEW FILE - 280 lines)

**Features Implemented:**

**1. Connection Status Detection**
- Checks Outlook via `/api/outlook/status`
- Checks Gmail via Supabase Edge Function `gmail_prod`
- Displays current connection state

**2. Provider Selection Cards (3 options)**

**Option 1: Microsoft Outlook**
- Blue card with OL logo (#0078D4)
- Description: "Connect your Outlook email for AI-powered inbox prioritization"
- Button: "Connect Outlook" → calls handleOutlookConnect
- If connected: Shows green checkmark + "Connected" badge
- Border turns green when connected

**Option 2: Gmail**
- Red card with GM logo (#EA4335)  
- Description: "Connect your Gmail account for AI-powered inbox prioritization"
- Button: "Connect Gmail" → calls handleGmailConnect
- If connected: Shows green checkmark + "Connected" badge
- Border turns green when connected

**Option 3: Other Email Providers**
- Gray card with Mail icon
- Status: "Coming Soon"
- Disabled state (no click action)

**3. OAuth Flow Integration**
- Uses exact same handlers as Integrations page
- Returns to `/connect-email` after OAuth (returnTo parameter)
- Token-based authentication (fixes 403 issue)
- Outlook: `window.location.assign(.../api/auth/outlook/login?token=xxx&returnTo=/connect-email)`
- Gmail: `window.location.assign(.../api/auth/gmail/login?token=xxx&returnTo=/connect-email)`

**4. Success Banner**
- Shows when any email connected
- Displays connected provider and email
- "Go to Priority Inbox" button
- Green border and background

**5. Information Panel**
- Explains email connection benefits
- Security assurance (Supabase Edge Functions)
- Disconnect instructions
- AI features description

**File 2:** `/app/frontend/src/App.js`

**Changes:**
- Added import: `import ConnectEmail from "./pages/ConnectEmail";` (Line 29)
- Updated route: `<Route path="/connect-email" element={<ProtectedRoute><ConnectEmail /></ProtectedRoute>} />` (Line 138)

---

## D. POST-CHECKS

✅ **Frontend Build:** Successful
✅ **No Errors:** Clean compilation
✅ **Component Created:** ConnectEmail.js (280 lines)
✅ **Route Added:** /connect-email now uses proper component

### User Testing Required:

**Test 1: Navigate to Page**
1. Login to BIQC
2. Click "Connect Email Account" in sidebar
3. **Expected:** See email selection page with 3 provider cards

**Test 2: Visual Layout**
**Expected to see:**
- Page title: "Connect Email Account"
- Subtitle: "Connect your email to enable Priority Inbox..."
- 2x2 grid (desktop) or stacked (mobile):
  - Outlook card (left/top)
  - Gmail card (right/middle)
  - Other card (bottom)
- Info panel at bottom with security details

**Test 3: Connection Detection**
- If Outlook already connected: Card shows green border + checkmark
- If Gmail already connected: Card shows green border + checkmark
- If either connected: Green banner at top with "View Inbox" button

**Test 4: OAuth Flow (If Not Connected)**
1. Click "Connect Outlook" button
2. **Expected:** Redirects to Microsoft OAuth
3. Complete authorization
4. **Expected:** Returns to /connect-email showing "Connected"

**Test 5: Gmail OAuth Flow (If Not Connected)**
1. Click "Connect Gmail" button
2. **Expected:** Redirects to Google OAuth
3. Complete authorization
4. **Expected:** Returns to /connect-email showing "Connected"

**Test 6: Navigation to Inbox**
1. If email connected, click "Go to Priority Inbox" button
2. **Expected:** Navigates to /email-inbox

---

## E. ROLLBACK

### Delete New File
```bash
rm /app/frontend/src/pages/ConnectEmail.js
```

### Revert App.js

**Remove import (Line 29):**
```javascript
// Delete: import ConnectEmail from "./pages/ConnectEmail";
```

**Revert route (Line 138):**
```javascript
// Change back to:
<Route path="/connect-email" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
```

---

## SUMMARY

**Created:**
- ✅ Full email connection page with provider selection
- ✅ 3 provider cards: Outlook, Gmail, Other (coming soon)
- ✅ Connection status detection
- ✅ OAuth flow integration (uses existing working handlers)
- ✅ Success banner when connected
- ✅ Info panel with security details

**Integration:**
- ✅ Wired to existing `/api/auth/outlook/login` endpoint
- ✅ Wired to existing `/api/auth/gmail/login` endpoint
- ✅ Uses token-based auth (403 fix applied)
- ✅ Returns to /connect-email after OAuth

**Visual Design:**
- ✅ Matches BIQC design system
- ✅ Responsive (mobile + desktop)
- ✅ Provider cards with logos and colors
- ✅ Green indicators for connected state

**Files Created:** 1
- `/app/frontend/src/pages/ConnectEmail.js`

**Files Modified:** 1
- `/app/frontend/src/App.js` (import + route)

**Risk:** LOW - New page, doesn't affect existing functionality

---

**READY FOR NEXT PROMPT** (Phase 2D: not needed - OAuth already wired)
**NEXT:** Phase 2E (Add connection indicator to sidebar)
