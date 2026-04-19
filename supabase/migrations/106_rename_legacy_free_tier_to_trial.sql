-- 106_rename_legacy_free_tier_to_trial.sql
-- HIGH-1 γ (2026-04-19): final cleanup of the "no free tier" rollout.
-- Renames legacy `subscription_tier='free'` rows to `'trial'` on the two
-- tables that store it. Frontend (PR #345) and backend (PR #346) already
-- treat the two values equivalently, so this migration is cleanup only —
-- no behaviour change, no downtime.
--
-- Applied to prod via Supabase MCP on 2026-04-19 after manual pre-check
-- showed only 1 user + 1 business_profile row on the old value. Idempotent
-- by design: if re-run on a fresh DB after the files-based migration
-- pipeline catches up, the UPDATEs match zero rows and are no-ops.
-- Approved by Andreas (code 13041978).

UPDATE public.users
   SET subscription_tier = 'trial'
 WHERE subscription_tier = 'free';

UPDATE public.business_profiles
   SET subscription_tier = 'trial'
 WHERE subscription_tier = 'free';

-- Column-level DEFAULT 'free' on the legacy schema migrations (028, 040,
-- 044, 047, 048, 055, 056, 064, 066, 086, 090) is intentionally LEFT
-- alone for now — changing DEFAULTs across 11 historical files is risky
-- and low value given backend code always writes an explicit tier at
-- signup. A follow-up migration can ALTER COLUMN SET DEFAULT 'trial'
-- once we're sure no internal tooling or seed script depends on the old
-- default behaviour.
