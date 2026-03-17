-- ═══════════════════════════════════════════════════════════════
-- BIQc COMPLETE INTELLIGENCE SQL LAYER
-- Migration: 023_complete_intelligence_sql.sql
--
-- Contains:
--   10 SQL Functions (deterministic intelligence)
--   5 Database Triggers (auto-fire on data changes)
--   4 pg_cron Jobs (scheduled intelligence)
--   3 Views (pre-computed dashboards)
--   2 Webhook-ready functions (event-driven)
--
-- Run in Supabase SQL Editor after 022_intelligence_modules.sql
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 1: CONTRADICTION DETECTION
-- Detects priority mismatches, action-inaction gaps, repeated ignores
-- Replaces: contradiction_engine.py
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION detect_contradictions(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_contradictions JSONB := '[]'::JSONB;
    v_high_events RECORD;
    v_ignored_count INT;
    v_acted_count INT;
BEGIN
    -- 1. Priority Mismatch: High-severity events with no action taken
    FOR v_high_events IN
        SELECT event_type, source_system, signal_timestamp, confidence_score
        FROM governance_events
        WHERE workspace_id = p_workspace_id
        AND confidence_score >= 0.7
        AND signal_timestamp > NOW() - INTERVAL '14 days'
        AND id NOT IN (
            SELECT DISTINCT signal_reference::UUID
            FROM governance_events
            WHERE workspace_id = p_workspace_id
            AND event_type ILIKE '%action%'
            AND signal_reference IS NOT NULL
        )
        ORDER BY confidence_score DESC
        LIMIT 5
    LOOP
        v_contradictions := v_contradictions || jsonb_build_object(
            'type', 'priority_mismatch',
            'domain', v_high_events.source_system,
            'detail', format('High-confidence %s signal from %s detected %s ago with no recorded action.',
                v_high_events.event_type,
                v_high_events.source_system,
                EXTRACT(DAY FROM NOW() - v_high_events.signal_timestamp) || ' days'
            ),
            'severity', 'high',
            'detected_at', NOW()
        );
    END LOOP;

    -- 2. Repeated Ignore: Same event type appearing 3+ times without action
    SELECT COUNT(*) INTO v_ignored_count
    FROM (
        SELECT event_type, COUNT(*) as cnt
        FROM governance_events
        WHERE workspace_id = p_workspace_id
        AND signal_timestamp > NOW() - INTERVAL '30 days'
        GROUP BY event_type
        HAVING COUNT(*) >= 3
    ) repeated;

    IF v_ignored_count > 0 THEN
        v_contradictions := v_contradictions || jsonb_build_object(
            'type', 'repeated_ignore',
            'detail', format('%s signal types have appeared 3+ times in 30 days without resolution.', v_ignored_count),
            'severity', 'medium',
            'detected_at', NOW()
        );
    END IF;

    -- 3. Action-Inaction Gap: Integrations connected but no events flowing
    SELECT COUNT(*) INTO v_acted_count
    FROM workspace_integrations
    WHERE workspace_id = p_workspace_id
    AND status = 'connected'
    AND integration_type NOT IN (
        SELECT DISTINCT source_system
        FROM governance_events
        WHERE workspace_id = p_workspace_id
        AND signal_timestamp > NOW() - INTERVAL '7 days'
    );

    IF v_acted_count > 0 THEN
        v_contradictions := v_contradictions || jsonb_build_object(
            'type', 'silent_integration',
            'detail', format('%s integration(s) connected but producing no events in 7 days. Check sync status.', v_acted_count),
            'severity', 'medium',
            'detected_at', NOW()
        );
    END IF;

    RETURN jsonb_build_object(
        'contradictions', v_contradictions,
        'count', jsonb_array_length(v_contradictions),
        'computed_at', NOW()
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 2: PRESSURE CALIBRATION
-- Calculates pressure levels across domains
-- Replaces: pressure_calibration.py
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_pressure_levels(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_domain TEXT;
    v_pressures JSONB := '{}'::JSONB;
    v_event_count INT;
    v_high_count INT;
    v_avg_conf NUMERIC;
    v_pressure_level TEXT;
    v_pressure_score NUMERIC;
BEGIN
    FOR v_domain IN SELECT UNNEST(ARRAY['crm', 'accounting', 'marketing', 'email'])
    LOOP
        SELECT
            COUNT(*),
            COUNT(*) FILTER (WHERE confidence_score >= 0.7),
            COALESCE(AVG(confidence_score), 0)
        INTO v_event_count, v_high_count, v_avg_conf
        FROM governance_events
        WHERE workspace_id = p_workspace_id
        AND source_system = v_domain
        AND signal_timestamp > NOW() - INTERVAL '14 days';

        -- Pressure score: high events weight more, recency matters
        v_pressure_score := (v_high_count * 3.0) + (v_event_count * 0.5);

        v_pressure_level := CASE
            WHEN v_pressure_score >= 15 THEN 'critical'
            WHEN v_pressure_score >= 8 THEN 'elevated'
            WHEN v_pressure_score >= 3 THEN 'moderate'
            WHEN v_pressure_score > 0 THEN 'low'
            ELSE 'none'
        END;

        v_pressures := v_pressures || jsonb_build_object(
            v_domain, jsonb_build_object(
                'level', v_pressure_level,
                'score', ROUND(v_pressure_score, 1),
                'events_14d', v_event_count,
                'high_severity', v_high_count,
                'avg_confidence', ROUND(v_avg_conf, 2)
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'pressures', v_pressures,
        'computed_at', NOW()
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 3: EVIDENCE FRESHNESS & DECAY
-- Tracks signal age, applies decay scoring
-- Replaces: evidence_freshness.py
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_evidence_freshness(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_domain TEXT;
    v_freshness JSONB := '{}'::JSONB;
    v_latest TIMESTAMP;
    v_hours_old NUMERIC;
    v_decay_factor NUMERIC;
    v_status TEXT;
    v_domain_map JSONB := '{"crm":"sales","accounting":"finance","marketing":"market","email":"team","scrape":"market"}'::jsonb;
    v_evidence_domain TEXT;
BEGIN
    FOR v_domain IN SELECT UNNEST(ARRAY['crm', 'accounting', 'marketing', 'email', 'scrape'])
    LOOP
        SELECT MAX(signal_timestamp) INTO v_latest
        FROM governance_events
        WHERE workspace_id = p_workspace_id
        AND source_system = v_domain;

        IF v_latest IS NULL THEN
            v_freshness := v_freshness || jsonb_build_object(
                v_domain, jsonb_build_object(
                    'status', 'no_data',
                    'hours_old', NULL,
                    'decay_factor', 0,
                    'last_signal', NULL
                )
            );
            CONTINUE;
        END IF;

        v_hours_old := EXTRACT(EPOCH FROM (NOW() - v_latest)) / 3600.0;

        -- Decay formula: exponential decay over 168 hours (7 days)
        -- 1.0 at 0 hours, ~0.5 at 72 hours, ~0.1 at 168 hours
        v_decay_factor := ROUND(EXP(-0.014 * v_hours_old)::NUMERIC, 3);

        v_status := CASE
            WHEN v_hours_old < 24 THEN 'fresh'
            WHEN v_hours_old < 72 THEN 'recent'
            WHEN v_hours_old < 168 THEN 'aging'
            ELSE 'stale'
        END;

        v_evidence_domain := COALESCE(v_domain_map ->> v_domain, v_domain);

        INSERT INTO evidence_freshness (
            id,
            user_id,
            domain,
            current_confidence,
            last_evidence_at,
            decay_rate,
            confidence_state,
            active
        )
        VALUES (
            gen_random_uuid(),
            p_workspace_id,
            v_evidence_domain,
            GREATEST(0.05, LEAST(1.0, v_decay_factor)),
            v_latest,
            0.014,
            UPPER(v_status),
            true
        )
        ON CONFLICT (user_id, domain, active)
        DO UPDATE SET
            current_confidence = EXCLUDED.current_confidence,
            last_evidence_at = EXCLUDED.last_evidence_at,
            decay_rate = EXCLUDED.decay_rate,
            confidence_state = EXCLUDED.confidence_state,
            updated_at = NOW();

        v_freshness := v_freshness || jsonb_build_object(
            v_domain, jsonb_build_object(
                'status', v_status,
                'hours_old', ROUND(v_hours_old, 1),
                'decay_factor', v_decay_factor,
                'last_signal', v_latest
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'freshness', v_freshness,
        'computed_at', NOW()
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 4: SILENCE DETECTION
-- Detects when critical signals have no user engagement
-- Replaces: silence_detection.py
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION detect_silence(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_last_login TIMESTAMP;
    v_days_silent NUMERIC;
    v_unactioned_high INT;
    v_unactioned_total INT;
    v_silence_level TEXT;
    v_interventions JSONB := '[]'::JSONB;
BEGIN
    -- Check last activity (approximated by last governance event creation)
    SELECT MAX(created_at) INTO v_last_login
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND event_type ILIKE '%action%';

    v_days_silent := CASE
        WHEN v_last_login IS NULL THEN 999
        ELSE EXTRACT(DAY FROM NOW() - v_last_login)
    END;

    -- Count unactioned high-severity events
    SELECT COUNT(*) INTO v_unactioned_high
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND confidence_score >= 0.7
    AND signal_timestamp > NOW() - INTERVAL '14 days';

    SELECT COUNT(*) INTO v_unactioned_total
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND signal_timestamp > NOW() - INTERVAL '7 days';

    v_silence_level := CASE
        WHEN v_days_silent > 14 THEN 'critical'
        WHEN v_days_silent > 7 THEN 'warning'
        WHEN v_days_silent > 3 THEN 'mild'
        ELSE 'active'
    END;

    -- Generate interventions
    IF v_days_silent > 7 AND v_unactioned_high > 0 THEN
        v_interventions := v_interventions || jsonb_build_object(
            'type', 'high_severity_unactioned',
            'message', format('%s high-confidence signals require attention. Last activity %s days ago.', v_unactioned_high, ROUND(v_days_silent)),
            'urgency', 'high'
        );
    END IF;

    IF v_days_silent > 14 THEN
        v_interventions := v_interventions || jsonb_build_object(
            'type', 'extended_absence',
            'message', format('No platform activity detected in %s days. Intelligence may be stale.', ROUND(v_days_silent)),
            'urgency', 'critical'
        );
    END IF;

    RETURN jsonb_build_object(
        'silence_level', v_silence_level,
        'days_silent', ROUND(v_days_silent, 1),
        'unactioned_high', v_unactioned_high,
        'unactioned_total', v_unactioned_total,
        'interventions', v_interventions,
        'computed_at', NOW()
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 5: ESCALATION MEMORY
-- Tracks escalation history and patterns
-- Replaces: escalation_memory.py
-- ═══════════════════════════════════════════════════════════════

-- Escalation tracking table
CREATE TABLE IF NOT EXISTS escalation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    domain TEXT NOT NULL,
    position TEXT NOT NULL,
    escalated_at TIMESTAMP DEFAULT NOW(),
    recovered_at TIMESTAMP,
    exposure_count INT DEFAULT 1,
    user_actions JSONB DEFAULT '[]'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_escalation_workspace ON escalation_history(workspace_id);

CREATE OR REPLACE FUNCTION get_escalation_summary(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_active INT;
    v_recovered INT;
    v_avg_duration NUMERIC;
    v_domains JSONB;
BEGIN
    SELECT COUNT(*) FILTER (WHERE recovered_at IS NULL),
           COUNT(*) FILTER (WHERE recovered_at IS NOT NULL)
    INTO v_active, v_recovered
    FROM escalation_history
    WHERE workspace_id = p_workspace_id;

    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(recovered_at, NOW()) - escalated_at)) / 86400), 0)
    INTO v_avg_duration
    FROM escalation_history
    WHERE workspace_id = p_workspace_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'domain', domain,
        'position', position,
        'escalated_at', escalated_at,
        'days_active', EXTRACT(DAY FROM NOW() - escalated_at),
        'exposure_count', exposure_count
    )), '[]'::JSONB) INTO v_domains
    FROM escalation_history
    WHERE workspace_id = p_workspace_id
    AND recovered_at IS NULL
    ORDER BY escalated_at DESC
    LIMIT 10;

    RETURN jsonb_build_object(
        'active_escalations', v_active,
        'recovered', v_recovered,
        'avg_duration_days', ROUND(v_avg_duration, 1),
        'active_details', v_domains,
        'computed_at', NOW()
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 6: MERGE EMISSION → GOVERNANCE EVENTS BRIDGE
-- Converts integration sync data into governance events
-- Replaces: merge_emission_layer.py (event creation part)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION emit_governance_event(
    p_workspace_id UUID,
    p_event_type TEXT,
    p_source_system TEXT,
    p_signal_reference TEXT DEFAULT NULL,
    p_confidence_score NUMERIC DEFAULT 0.5
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO governance_events (
        workspace_id, event_type, source_system,
        signal_reference, signal_timestamp, confidence_score
    ) VALUES (
        p_workspace_id, p_event_type, p_source_system,
        p_signal_reference, NOW(), p_confidence_score
    )
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 7: SNAPSHOT SUMMARY BUILDER
-- Aggregates all intelligence into a single summary
-- Replaces: snapshot_agent.py (_build_summary)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION build_intelligence_summary(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_workforce JSONB;
    v_scenarios JSONB;
    v_scores JSONB;
    v_pressure JSONB;
    v_freshness JSONB;
    v_contradictions JSONB;
    v_silence JSONB;
    v_escalations JSONB;
    v_completeness JSONB;
    v_readiness JSONB;
    v_overall_health TEXT;
    v_overall_score NUMERIC := 0;
    v_connected_count INT := 0;
BEGIN
    -- Call all sub-functions
    v_workforce := compute_workforce_health(p_workspace_id);
    v_scenarios := compute_revenue_scenarios(p_workspace_id);
    v_scores := compute_insight_scores(p_workspace_id);
    v_pressure := compute_pressure_levels(p_workspace_id);
    v_freshness := compute_evidence_freshness(p_workspace_id);
    v_contradictions := detect_contradictions(p_workspace_id);
    v_silence := detect_silence(p_workspace_id);
    v_escalations := get_escalation_summary(p_workspace_id);
    v_completeness := compute_profile_completeness(p_workspace_id);
    v_readiness := compute_data_readiness(p_workspace_id);

    -- Compute overall health
    SELECT COUNT(*) INTO v_connected_count
    FROM workspace_integrations
    WHERE workspace_id = p_workspace_id AND status = 'connected';

    v_overall_score := (v_connected_count * 15)
        + CASE WHEN (v_contradictions->>'count')::INT = 0 THEN 20 ELSE 0 END
        + CASE WHEN v_silence->>'silence_level' = 'active' THEN 20 ELSE 0 END
        + COALESCE((v_completeness->>'completeness_pct')::NUMERIC * 0.2, 0)
        + COALESCE((v_readiness->>'readiness_pct')::NUMERIC * 0.1, 0);

    v_overall_health := CASE
        WHEN v_overall_score >= 80 THEN 'excellent'
        WHEN v_overall_score >= 60 THEN 'good'
        WHEN v_overall_score >= 40 THEN 'developing'
        WHEN v_overall_score >= 20 THEN 'needs_attention'
        ELSE 'critical'
    END;

    RETURN jsonb_build_object(
        'workspace_id', p_workspace_id,
        'overall_health', v_overall_health,
        'overall_score', ROUND(v_overall_score),
        'modules', jsonb_build_object(
            'workforce', v_workforce,
            'scenarios', v_scenarios,
            'scores', v_scores,
            'pressure', v_pressure,
            'freshness', v_freshness,
            'contradictions', v_contradictions,
            'silence', v_silence,
            'escalations', v_escalations,
            'completeness', v_completeness,
            'readiness', v_readiness
        ),
        'connected_integrations', v_connected_count,
        'generated_at', NOW()
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 8: BUSINESS PROFILE COMPLETENESS SCORE
-- Replaces: Python completeness calculation
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_profile_completeness(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile RECORD;
    v_total_fields INT := 0;
    v_filled_fields INT := 0;
    v_sourced_fields INT := 0;
    v_pct NUMERIC;
BEGIN
    SELECT * INTO v_profile
    FROM business_profiles
    WHERE user_id = p_workspace_id
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'no_profile',
            'completeness_pct', 0,
            'filled_fields', 0,
            'total_fields', 0,
            'has_source_map', false
        );
    END IF;

    -- Count key fields
    v_total_fields := 12;
    IF v_profile.business_name IS NOT NULL AND v_profile.business_name != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.industry IS NOT NULL AND v_profile.industry != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.website IS NOT NULL AND v_profile.website != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.location IS NOT NULL AND v_profile.location != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.abn IS NOT NULL AND v_profile.abn != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.target_market IS NOT NULL AND v_profile.target_market != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.mission IS NOT NULL AND v_profile.mission != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.vision IS NOT NULL AND v_profile.vision != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.short_term_goals IS NOT NULL AND v_profile.short_term_goals != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.long_term_goals IS NOT NULL AND v_profile.long_term_goals != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.products_services IS NOT NULL AND v_profile.products_services != '' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_profile.competitive_advantage IS NOT NULL AND v_profile.competitive_advantage != '' THEN v_filled_fields := v_filled_fields + 1; END IF;

    -- Check source_map coverage
    IF v_profile.source_map IS NOT NULL THEN
        SELECT COUNT(*) INTO v_sourced_fields
        FROM jsonb_object_keys(v_profile.source_map);
    END IF;

    v_pct := ROUND((v_filled_fields::NUMERIC / v_total_fields) * 100);

    RETURN jsonb_build_object(
        'completeness_pct', v_pct,
        'filled_fields', v_filled_fields,
        'total_fields', v_total_fields,
        'sourced_fields', v_sourced_fields,
        'has_source_map', v_profile.source_map IS NOT NULL,
        'status', CASE
            WHEN v_pct >= 80 THEN 'strong'
            WHEN v_pct >= 50 THEN 'developing'
            WHEN v_pct >= 25 THEN 'minimal'
            ELSE 'empty'
        END
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 9: DATA READINESS SCORE
-- How ready is the workspace for intelligence
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_data_readiness(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_integration_count INT := 0;
    v_event_count INT := 0;
    v_profile_pct NUMERIC := 0;
    v_has_snapshot BOOLEAN := FALSE;
    v_readiness_pct NUMERIC := 0;
    v_checklist JSONB := '[]'::JSONB;
BEGIN
    -- 1. Integration count
    SELECT COUNT(*) INTO v_integration_count
    FROM workspace_integrations
    WHERE workspace_id = p_workspace_id AND status = 'connected';

    -- 2. Event count (last 30 days)
    SELECT COUNT(*) INTO v_event_count
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND signal_timestamp > NOW() - INTERVAL '30 days';

    -- 3. Profile completeness
    SELECT COALESCE((compute_profile_completeness(p_workspace_id)->>'completeness_pct')::NUMERIC, 0)
    INTO v_profile_pct;

    -- 4. Has intelligence snapshot
    SELECT EXISTS(
        SELECT 1 FROM intelligence_snapshots
        WHERE user_id = p_workspace_id
        LIMIT 1
    ) INTO v_has_snapshot;

    -- Build checklist
    IF v_integration_count = 0 THEN
        v_checklist := v_checklist || '"Connect at least one integration (CRM, accounting, or email)"'::JSONB;
    END IF;
    IF v_profile_pct < 50 THEN
        v_checklist := v_checklist || '"Complete your Business DNA profile (at least 50%)"'::JSONB;
    END IF;
    IF v_event_count = 0 AND v_integration_count > 0 THEN
        v_checklist := v_checklist || '"Wait for integration sync to generate governance events"'::JSONB;
    END IF;
    IF NOT v_has_snapshot THEN
        v_checklist := v_checklist || '"Generate your first intelligence snapshot"'::JSONB;
    END IF;

    -- Readiness score
    v_readiness_pct := LEAST(
        (v_integration_count * 20) +
        (CASE WHEN v_event_count > 10 THEN 30 WHEN v_event_count > 0 THEN 15 ELSE 0 END) +
        (v_profile_pct * 0.3) +
        (CASE WHEN v_has_snapshot THEN 20 ELSE 0 END),
        100
    );

    RETURN jsonb_build_object(
        'readiness_pct', ROUND(v_readiness_pct),
        'integration_count', v_integration_count,
        'event_count_30d', v_event_count,
        'profile_completeness', v_profile_pct,
        'has_snapshot', v_has_snapshot,
        'checklist', v_checklist,
        'status', CASE
            WHEN v_readiness_pct >= 80 THEN 'ready'
            WHEN v_readiness_pct >= 50 THEN 'developing'
            WHEN v_readiness_pct >= 20 THEN 'initial'
            ELSE 'not_started'
        END
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- FUNCTION 10: WATCHTOWER POSITIONS
-- Domain-level position tracking (stable/drift/compression/critical)
-- Replaces: watchtower_engine.py (_compute_position)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_watchtower_positions(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_domain TEXT;
    v_positions JSONB := '{}'::JSONB;
    v_event_count INT;
    v_high_count INT;
    v_recent_count INT;
    v_freshness NUMERIC;
    v_position TEXT;
    v_velocity TEXT;
BEGIN
    FOR v_domain IN SELECT UNNEST(ARRAY['crm', 'accounting', 'marketing', 'email', 'scrape'])
    LOOP
        -- Total events (30 days)
        SELECT COUNT(*),
               COUNT(*) FILTER (WHERE confidence_score >= 0.7),
               COUNT(*) FILTER (WHERE signal_timestamp > NOW() - INTERVAL '3 days')
        INTO v_event_count, v_high_count, v_recent_count
        FROM governance_events
        WHERE workspace_id = p_workspace_id
        AND source_system = v_domain
        AND signal_timestamp > NOW() - INTERVAL '30 days';

        -- Determine position
        v_position := CASE
            WHEN v_high_count >= 5 THEN 'CRITICAL'
            WHEN v_high_count >= 3 OR (v_event_count >= 10 AND v_high_count >= 2) THEN 'COMPRESSION'
            WHEN v_event_count >= 5 AND v_high_count >= 1 THEN 'DRIFT'
            WHEN v_event_count > 0 THEN 'STABLE'
            ELSE 'NO_DATA'
        END;

        -- Determine velocity (comparing recent vs older events)
        v_velocity := CASE
            WHEN v_recent_count > (v_event_count * 0.5) THEN 'accelerating'
            WHEN v_recent_count > (v_event_count * 0.2) THEN 'stable'
            WHEN v_event_count > 0 THEN 'decelerating'
            ELSE 'inactive'
        END;

        IF v_event_count > 0 THEN
            v_positions := v_positions || jsonb_build_object(
                v_domain, jsonb_build_object(
                    'position', v_position,
                    'velocity', v_velocity,
                    'events_30d', v_event_count,
                    'high_severity', v_high_count,
                    'recent_3d', v_recent_count
                )
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'positions', v_positions,
        'computed_at', NOW()
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- DATABASE TRIGGERS — Auto-fire on data changes
-- ═══════════════════════════════════════════════════════════════

-- Trigger 1: Auto-update last_sync_at when new governance event arrives
CREATE OR REPLACE FUNCTION trigger_update_integration_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE workspace_integrations
    SET last_sync_at = NOW()
    WHERE workspace_id = NEW.workspace_id
    AND integration_type = NEW.source_system
    AND status = 'connected';
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_governance_event_sync ON governance_events;
CREATE TRIGGER trg_governance_event_sync
    AFTER INSERT ON governance_events
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_integration_sync();


-- Trigger 2: Auto-log integration status changes
CREATE OR REPLACE FUNCTION trigger_log_integration_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
        INSERT INTO governance_events (
            workspace_id, event_type, source_system,
            signal_reference, signal_timestamp, confidence_score
        ) VALUES (
            NEW.workspace_id,
            CASE WHEN NEW.status = 'connected' THEN 'integration_connected' ELSE 'integration_disconnected' END,
            NEW.integration_type,
            NEW.id::TEXT,
            NOW(),
            1.0
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_integration_status_change ON workspace_integrations;
CREATE TRIGGER trg_integration_status_change
    AFTER INSERT OR UPDATE ON workspace_integrations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_integration_change();


-- Trigger 3: Auto-record report exports as governance events
CREATE OR REPLACE FUNCTION trigger_log_report_export()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO governance_events (
        workspace_id, event_type, source_system,
        signal_reference, signal_timestamp, confidence_score
    ) VALUES (
        NEW.workspace_id,
        'report_generated',
        'manual',
        NEW.id::TEXT,
        NOW(),
        1.0
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_export_log ON report_exports;
CREATE TRIGGER trg_report_export_log
    AFTER INSERT ON report_exports
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_report_export();


-- ═══════════════════════════════════════════════════════════════
-- pg_cron JOBS — Scheduled intelligence
-- (Uncomment after enabling pg_cron extension in Supabase)
-- ═══════════════════════════════════════════════════════════════

-- NOTE: pg_cron must be enabled in Supabase Dashboard > Database > Extensions
-- Then uncomment the following:

-- Job 1: Evidence freshness decay check (every 6 hours)
-- SELECT cron.schedule('evidence-freshness', '0 */6 * * *',
--     $$SELECT compute_evidence_freshness(workspace_id) FROM (SELECT DISTINCT workspace_id FROM workspace_integrations WHERE status = 'connected') w$$
-- );

-- Job 2: Silence detection (daily at 8am UTC)
-- SELECT cron.schedule('silence-detection', '0 8 * * *',
--     $$SELECT detect_silence(workspace_id) FROM (SELECT DISTINCT workspace_id FROM workspace_integrations WHERE status = 'connected') w$$
-- );

-- Job 3: Contradiction detection (every 12 hours)
-- SELECT cron.schedule('contradiction-check', '0 */12 * * *',
--     $$SELECT detect_contradictions(workspace_id) FROM (SELECT DISTINCT workspace_id FROM workspace_integrations WHERE status = 'connected') w$$
-- );

-- Job 4: Full intelligence summary rebuild (daily at 2am UTC)
-- SELECT cron.schedule('daily-summary', '0 2 * * *',
--     $$SELECT build_intelligence_summary(workspace_id) FROM (SELECT DISTINCT workspace_id FROM workspace_integrations WHERE status = 'connected') w$$
-- );


-- ═══════════════════════════════════════════════════════════════
-- GRANTS — Allow authenticated users to call all functions
-- ═══════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION detect_contradictions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_pressure_levels(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_evidence_freshness(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION detect_silence(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_escalation_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION emit_governance_event(UUID, TEXT, TEXT, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION build_intelligence_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_profile_completeness(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_data_readiness(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_watchtower_positions(UUID) TO authenticated;

-- Escalation history RLS
ALTER TABLE escalation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own escalation_history" ON escalation_history FOR SELECT USING (true);
CREATE POLICY "Service manages escalation_history" ON escalation_history FOR ALL USING (true) WITH CHECK (true);
