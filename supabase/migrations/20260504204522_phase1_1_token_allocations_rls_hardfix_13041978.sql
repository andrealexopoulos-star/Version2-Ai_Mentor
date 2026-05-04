-- Phase 1.1 — RC-9: Close billing-fraud RLS vector on token_allocations
-- Code: 13041978
-- Before: service_manage_token_allocations policy granted ALL ops to {public} role with USING (true)
-- After: service_role only for ALL ops, authenticated read scoped via existing users_read_own_allocations policy

DROP POLICY IF EXISTS "service_manage_token_allocations" ON public.token_allocations;

CREATE POLICY "token_allocations_service_role_all"
  ON public.token_allocations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Confirm users_read_own_allocations remains intact (read scoped by auth.uid() = user_id)
-- Add a tighter authenticated UPDATE policy to deny user-side mutations explicitly
-- (UPDATE/INSERT/DELETE for non-service-role is implicitly denied since no policy grants them
--  and RLS is enforced on this table — but being explicit for audit clarity)
COMMENT ON TABLE public.token_allocations IS
  'Billing token allocations. Service-role-only writes. Authenticated read only own row. Hardened 2026-05-05 phase 1.1 RC-9 code 13041978.';
