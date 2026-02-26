# Merge.dev Phase 2 - Manual Test Checklist

## ✅ Implementation Complete

Phase 2 adds the Merge Link UI modal integration.

---

## 🧪 Manual Testing Checklist

### Prerequisites
- [ ] User is logged in as andre.alexopoulos@gmail.com
- [ ] Navigate to: https://biqc-ai-insights.preview.emergentagent.com/integrations
- [ ] Open browser console (F12 → Console tab)

---

### Test Steps

#### ✅ Step 1: Verify UI Appears
- [ ] "Merge Unified Integrations" card is visible at top of page
- [ ] Card shows description: "Connect to 200+ business tools..."
- [ ] Four category badges visible: Accounting, CRM, HRIS, ATS
- [ ] "Connect via Merge" button is present and enabled

#### ✅ Step 2: Click "Connect via Merge" Button
- [ ] Click the "Connect via Merge" button
- [ ] Button shows loading state: "Opening Merge..."
- [ ] Console shows: "🔗 Opening Merge Link..."
- [ ] Console shows: "✅ Session validated, requesting link token..."

#### ✅ Step 3: Backend Returns Link Token
- [ ] Console shows: "✅ Link token received: lt_xxxxxxxxxxxxx"
- [ ] HTTP Response Status: 200 (check Network tab if needed)
- [ ] No 401/403 authentication errors

#### ✅ Step 4: Merge Link Modal Opens
- [ ] Merge Link modal appears on screen
- [ ] Modal shows provider selection interface
- [ ] Modal is interactive and responsive
- [ ] Console shows: "✅ Opening Merge Link modal..."

#### ✅ Step 5: Test Provider Selection
- [ ] Select any provider from the list (e.g., QuickBooks, Salesforce, etc.)
- [ ] Provider authentication flow begins
- [ ] Can proceed through Merge Link flow

#### ✅ Step 6: Test Success Callback
**Option A: Complete Flow**
- [ ] Complete authentication with a provider
- [ ] Console shows: "✅ Merge Link Success!"
- [ ] Console shows: "📦 Public Token: [token]"
- [ ] Toast notification: "Integration connected successfully!"
- [ ] Button returns to "Connect via Merge" state

**Option B: Exit Without Connecting**
- [ ] Close the Merge Link modal without connecting
- [ ] Console shows: "ℹ️ Merge Link exited by user"
- [ ] Button returns to "Connect via Merge" state
- [ ] No errors

---

### Expected Console Output (Success Path)

```
🔗 Opening Merge Link...
✅ Session validated, requesting link token...
✅ Link token received: lt_xxxxxxxxxxxxx
✅ Opening Merge Link modal...
[User interacts with modal]
✅ Merge Link Success!
📦 Public Token: [token]
```

---

### Error Scenarios to Verify

#### If Not Logged In:
- [ ] Console shows: "❌ No active session found"
- [ ] Toast: "Please log in to connect integrations"
- [ ] Button returns to normal state

#### If Backend Fails:
- [ ] Console shows: "❌ Backend error: [error details]"
- [ ] Toast: "Failed to get link token: [error message]"
- [ ] Button returns to normal state

#### If MergeLink SDK Not Loaded:
- [ ] Console shows: "❌ MergeLink SDK not loaded"
- [ ] Toast: "Merge Link failed to load (see console)"
- [ ] Button returns to normal state

---

### Success Criteria (All Must Pass)

- [x] ✅ Merge Link script loads globally (check: `window.MergeLink` exists)
- [ ] ✅ User clicks "Connect via Merge"
- [ ] ✅ Backend returns link_token (200)
- [ ] ✅ Merge Link modal opens
- [ ] ✅ Selecting any provider proceeds to Merge Link flow
- [ ] ✅ onSuccess logs the success payload (NOT persisted)
- [ ] ✅ No runtime errors in console

---

## 📸 Screenshots to Capture

1. Integrations page with "Merge Unified Integrations" card
2. Button in loading state ("Opening Merge...")
3. Merge Link modal open
4. Console output showing success
5. Any errors (if they occur)

---

## 🚫 What NOT to Test (Out of Scope for Phase 2)

- ❌ Token persistence (not implemented yet)
- ❌ Webhook handling (not implemented yet)
- ❌ Data syncing (not implemented yet)
- ❌ Provider-specific logic (not implemented yet)
- ❌ Account management (not implemented yet)

---

## 📝 What to Report

After testing, please share:

1. **Did all checklist items pass?** (Yes/No for each)
2. **Console output** (full text from opening modal to callback)
3. **Did the Merge Link modal open?** (Yes/No + screenshot)
4. **Which provider did you test?** (if any)
5. **Did onSuccess callback fire?** (Yes/No + console output)
6. **Any errors?** (full error text + screenshot)

---

## 🎯 Phase 2 Completion

Phase 2 is COMPLETE when:
- ✅ Modal opens successfully
- ✅ Provider selection works
- ✅ onSuccess logs the public_token to console
- ✅ No console errors

**STOP at this point. Do NOT implement storage, webhooks, or syncing.**

---

## 🔄 Next Steps (Future Phases)

After Phase 2 validation:
- Phase 3: Token exchange and storage
- Phase 4: Webhook handling
- Phase 5: Data syncing

These are OUT OF SCOPE for current testing.
