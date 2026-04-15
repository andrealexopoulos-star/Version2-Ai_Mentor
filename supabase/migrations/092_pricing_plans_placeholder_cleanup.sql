-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION 092: pricing_plans placeholder cleanup
-- Inspection on 2026-04-15 showed 19 rows in public.pricing_plans with
-- monthly_price_cents = 1000 ($10 AUD) — all placeholder/draft seeds.
-- One of them (starter v1) was marked is_active=true, which would pull
-- through _resolve_governed_plan in backend/routes/stripe_payments.py
-- and create a $10 checkout once release approvals were recorded.
--
-- This migration neutralises every $10 row so none can be served to
-- live checkout, without deleting audit history.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Deactivate and mark every $10 placeholder row as a draft.
UPDATE public.pricing_plans
SET
    is_active = false,
    is_draft  = true,
    metadata  = COALESCE(metadata, '{}'::jsonb)
                 || jsonb_build_object(
                        'deactivated_by_migration', '092_pricing_plans_placeholder_cleanup',
                        'deactivated_reason', 'placeholder_price_1000_cents',
                        'deactivated_at', now()
                    ),
    updated_at = now()
WHERE monthly_price_cents = 1000;

-- 2. Audit log entry so the cleanup is traceable.
INSERT INTO public.pricing_audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state,
    context
)
SELECT
    NULL,
    'deactivate_placeholder_plan',
    'pricing_plan',
    id::text,
    jsonb_build_object(
        'plan_key', plan_key,
        'version', version,
        'monthly_price_cents', monthly_price_cents,
        'is_active', false,
        'is_draft', is_draft
    ),
    jsonb_build_object(
        'plan_key', plan_key,
        'version', version,
        'monthly_price_cents', monthly_price_cents,
        'is_active', false,
        'is_draft', true
    ),
    jsonb_build_object(
        'migration', '092_pricing_plans_placeholder_cleanup',
        'reason', 'placeholder_price_1000_cents'
    )
FROM public.pricing_plans
WHERE monthly_price_cents = 1000;
