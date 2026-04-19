# delete_account hard-delete cascade — proposal

**Date:** 2026-04-19 (overnight, for morning review)
**Driving source:** ship-gate residual #1 (from session handoff)

---

## Current state

`DELETE /user/account` in [backend/routes/user_settings.py:273](backend/routes/user_settings.py:273) is **soft-delete only**:

1. `business_profiles.subscription_tier = 'deleted'`
2. `users.is_active = false`
3. Disconnect all integrations

It does **NOT**:
- Delete the `auth.users` row
- Delete the `public.users` row
- Delete FK-referenced rows (cognitive_profiles, tutorial_progress, soundboard_conversations, etc.)
- Invalidate tokens in `outlook_oauth_tokens`, `email_connections`, etc.

**The bug:** when a user deletes and tries to re-sign-up with the same email, auth.users still has a row with that email → `users_email_key` unique-constraint violation → HTTP 500. Ship-gate acknowledged this as non-blocker at 100 users; likely to bite before 1,000.

## Why I did NOT ship this autonomously tonight

1. **Destructive and irreversible.** Hard-deletes across `auth.users` + FK-cascaded child rows. A bug in the cascade path = permanent customer data loss. No undo.
2. **Compliance touches.** Australian Privacy Principles + SOC 2 retention policies intersect with "when we delete" and "what we keep." The current "mark and clean after 30 days" pattern was probably a deliberate choice. Flipping it to "delete immediately" needs a legal/compliance read before ship.
3. **FK graph is wide.** I counted 120+ tables in `public.` schema when I did the earlier investigation. Not all of them have FKs to `users(id)`, but any that do need explicit cascade treatment. Missing one = orphan rows pointing at a deleted user.
4. **Ship-gate explicitly deferred this to post-launch.** Andreas's own direction: "ship fast with high trust and zero platform instability." A hard-delete refactor at 11pm on launch day is the opposite of that posture.

## Proposed approach (for your morning review)

### Option A (recommended): Keep soft-delete, fix the re-signup path

The real business problem is **"user can't re-sign-up with same email"** — not "delete doesn't hard-delete." Fix by allowing re-signup to REVIVE a soft-deleted row instead of creating a new one.

**Backend change (`auth_supabase.signup_with_email`):**

```python
# Check if user already exists in public.users
existing_user = await get_user_by_email(request.email)
if existing_user:
    # New: if user was soft-deleted, revive them
    if not existing_user.get("is_active", True):
        return await revive_soft_deleted_user(
            existing_user, request.email, request.password, user_metadata
        )
    raise HTTPException(status_code=400, detail="User with this email already exists")
```

Where `revive_soft_deleted_user` calls `supabase_admin.auth.admin.update_user_by_id(...)` to set a new password + clear the soft-delete flag.

**Effort:** ~2 hours. Non-destructive. Reversible. Works for 95% of real-world re-signup cases.
**Risk:** low.

### Option B: Add a separate "hard-delete" path

Create a new endpoint `POST /user/account/purge` that does the full auth.users + cascade wipe. Keep the existing `/user/account` as soft-delete. Only admins or the user themselves after an explicit "I want ALL my data gone forever" confirmation would hit the purge endpoint.

**Effort:** ~4-6 hours + compliance review. Requires the cascade migration and a thorough FK audit.
**Risk:** high without review.

### Option C: Do nothing until a customer hits it

Current 100-user launch volume makes this unlikely to bite immediately. Ship-gate already accepted this risk.

**Effort:** 0.
**Risk:** low short-term, grows with users.

## My recommendation

**Option A.** Ship the "revive soft-deleted user on re-signup" path. It's the actual product bug (re-signup failure), not a data-retention architecture change. Keep the existing soft-delete semantics and compliance story. Leave Option B as a later compliance-driven project.

## If you want Option A shipped

Say the word and I'll ship it in the next session with:
- `revive_soft_deleted_user` helper in `auth_supabase.py`
- Integration test for the signup → delete → signup-again flow
- Deploy + E2E verification

Code `13041978` scoped to that change before I touch it.
