# MICROSOFT ACCOUNT PICKER FIX

## A. GOAL
Force Microsoft OAuth to show account picker instead of auto-selecting cached account.

## B. ISSUE
User reported: "account picker not deployed on Microsoft sign in automatically selecting a email account"

## C. ROOT CAUSE
`prompt=select_account` parameter alone doesn't always force account picker in Microsoft OAuth. Microsoft may still auto-select if only one account is cached.

## D. FIX APPLIED

**File:** `/app/backend/server.py` Line 2511

**Changed:**
```python
# Before:
prompt=select_account

# After:
prompt=consent
```

**Why `prompt=consent` is better:**
- Forces account picker
- Forces re-consent to permissions
- Ensures user sees what they're authorizing
- Prevents auto-selection even with single cached account

## E. POST-CHECK

✅ Backend restarted
✅ Health check passing

### User Test Required:
1. Navigate to /integrations
2. Click Outlook → Connect
3. **Expected:** Microsoft shows account picker with all available accounts
4. Select desired account
5. Complete consent screen
6. Return to BIQC with connection established

## F. ROLLBACK

Revert to:
```python
prompt=select_account
```

---

**READY FOR NEXT PROMPT** (Phase 2: Sidebar Communications Section)
