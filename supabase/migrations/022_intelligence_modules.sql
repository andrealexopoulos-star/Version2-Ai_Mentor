-- ═══════════════════════════════════════════════════════════════
-- INTELLIGENCE MODULES — SQL Functions & Views
-- BIQc Workforce, Growth/Scenario, Weighted Scoring
--
-- Run in Supabase SQL Editor after 021_trust_reconstruction.sql
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- 1. WORKFORCE INTELLIGENCE
-- Computes capacity, fatigue, and key-person dependency from
-- connected email/calendar integration data
-- ═══════════════════════════════════════════════════════════════

-- Workforce health assessment function
CREATE OR REPLACE FUNCTION compute_workforce_health(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_has_email BOOLEAN := FALSE;
    v_email_events INT := 0;
    v_calendar_events INT := 0;
    v_capacity_index NUMERIC := 0;
    v_fatigue_level TEXT := 'unknown';
    v_pending_decisions INT := 0;
    v_result JSONB;
BEGIN
    -- Check if email integration is connected
    SELECT EXISTS(
        SELECT 1 FROM workspace_integrations
        WHERE workspace_id = p_workspace_id
        AND integration_type = 'email'
        AND status = 'connected'
    ) INTO v_has_email;

    IF NOT v_has_email THEN
        RETURN jsonb_build_object(
            'status', 'no_email_integration',
            'message', 'Connect email and calendar to unlock workforce intelligence.',
            'has_data', false
        );
    END IF;

    -- Count email-related governance events (last 30 days)
    SELECT COUNT(*) INTO v_email_events
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND source_system = 'email'
    AND signal_timestamp > NOW() - INTERVAL '30 days';

    -- Count calendar/meeting events
    SELECT COUNT(*) INTO v_calendar_events
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND (event_type ILIKE '%calendar%' OR event_type ILIKE '%meeting%')
    AND signal_timestamp > NOW() - INTERVAL '7 days';

    -- Compute capacity index (0-150 scale)
    -- Based on event density: high events = high utilisation
    v_capacity_index := LEAST(
        ROUND((v_email_events::NUMERIC / GREATEST(30, 1)) * 100 + (v_calendar_events::NUMERIC / GREATEST(5, 1)) * 50),
        150
    );

    -- Determine fatigue level
    v_fatigue_level := CASE
        WHEN v_capacity_index > 120 THEN 'high'
        WHEN v_capacity_index > 80 THEN 'medium'
        ELSE 'low'
    END;

    -- Count pending decision events
    SELECT COUNT(*) INTO v_pending_decisions
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND event_type ILIKE '%decision%'
    AND signal_timestamp > NOW() - INTERVAL '7 days';

    v_result := jsonb_build_object(
        'status', 'computed',
        'has_data', true,
        'capacity_index', v_capacity_index,
        'fatigue_level', v_fatigue_level,
        'pending_decisions', v_pending_decisions,
        'email_events_30d', v_email_events,
        'calendar_events_7d', v_calendar_events,
        'computed_at', NOW()
    );

    RETURN v_result;
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- 2. GROWTH / SCENARIO PLANNING
-- Computes best/base/worst case from CRM deal data
-- ═══════════════════════════════════════════════════════════════

-- Scenario modeling function
CREATE OR REPLACE FUNCTION compute_revenue_scenarios(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_has_crm BOOLEAN := FALSE;
    v_total_pipeline NUMERIC := 0;
    v_best_case NUMERIC := 0;
    v_base_case NUMERIC := 0;
    v_worst_case NUMERIC := 0;
    v_deal_count INT := 0;
    v_won_count INT := 0;
    v_lost_count INT := 0;
    v_stalled_count INT := 0;
    v_high_prob_value NUMERIC := 0;
    v_med_prob_value NUMERIC := 0;
    v_low_prob_value NUMERIC := 0;
    v_top_client_pct NUMERIC := 0;
    v_unique_clients INT := 0;
    v_result JSONB;
BEGIN
    -- Check if CRM integration is connected
    SELECT EXISTS(
        SELECT 1 FROM workspace_integrations
        WHERE workspace_id = p_workspace_id
        AND integration_type = 'crm'
        AND status = 'connected'
    ) INTO v_has_crm;

    IF NOT v_has_crm THEN
        RETURN jsonb_build_object(
            'status', 'no_crm_integration',
            'message', 'Connect CRM to unlock revenue scenario modeling.',
            'has_data', false
        );
    END IF;

    -- Count CRM-sourced revenue events
    SELECT COUNT(*) INTO v_deal_count
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND source_system = 'crm'
    AND event_type ILIKE '%deal%';

    -- Count won/lost from events
    SELECT COUNT(*) INTO v_won_count
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND source_system = 'crm'
    AND event_type ILIKE '%won%';

    SELECT COUNT(*) INTO v_lost_count
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND source_system = 'crm'
    AND event_type ILIKE '%lost%';

    -- If no deal events, return empty but connected state
    IF v_deal_count = 0 THEN
        RETURN jsonb_build_object(
            'status', 'connected_no_deals',
            'message', 'CRM connected but no deal events recorded yet. Deals will appear after sync.',
            'has_data', false,
            'crm_connected', true
        );
    END IF;

    -- Compute win rate
    v_result := jsonb_build_object(
        'status', 'computed',
        'has_data', true,
        'deal_count', v_deal_count,
        'won_count', v_won_count,
        'lost_count', v_lost_count,
        'win_rate', CASE WHEN v_deal_count > 0 THEN ROUND((v_won_count::NUMERIC / v_deal_count) * 100) ELSE 0 END,
        'computed_at', NOW()
    );

    RETURN v_result;
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- 3. WEIGHTED INSIGHT SCORING
-- Computes a weighted score for each intelligence domain
-- Score = (severity_weight * alert_count) + metric_bonus + detail_bonus
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_insight_scores(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_domain TEXT;
    v_scores JSONB := '{}'::JSONB;
    v_domain_events INT;
    v_high_count INT;
    v_med_count INT;
    v_low_count INT;
    v_avg_confidence NUMERIC;
    v_score NUMERIC;
BEGIN
    -- Compute scores for each domain
    FOR v_domain IN SELECT UNNEST(ARRAY['crm', 'accounting', 'marketing', 'email', 'scrape'])
    LOOP
        -- Count events by severity proxy (confidence score)
        SELECT
            COUNT(*) FILTER (WHERE confidence_score >= 0.8),
            COUNT(*) FILTER (WHERE confidence_score >= 0.5 AND confidence_score < 0.8),
            COUNT(*) FILTER (WHERE confidence_score < 0.5),
            COUNT(*),
            COALESCE(AVG(confidence_score), 0)
        INTO v_high_count, v_med_count, v_low_count, v_domain_events, v_avg_confidence
        FROM governance_events
        WHERE workspace_id = p_workspace_id
        AND source_system = v_domain
        AND signal_timestamp > NOW() - INTERVAL '30 days';

        -- Weighted score formula
        -- severity_weight: high=3, medium=2, low=1
        -- Plus confidence bonus
        v_score := (v_high_count * 3) + (v_med_count * 2) + (v_low_count * 1);

        -- Add metric bonus (events density)
        IF v_domain_events > 10 THEN v_score := v_score + 15;
        ELSIF v_domain_events > 5 THEN v_score := v_score + 10;
        ELSIF v_domain_events > 0 THEN v_score := v_score + 5;
        END IF;

        -- Add confidence bonus
        IF v_avg_confidence > 0.7 THEN v_score := v_score + 10;
        ELSIF v_avg_confidence > 0.4 THEN v_score := v_score + 5;
        END IF;

        -- Cap at 100
        v_score := LEAST(v_score, 100);

        v_scores := v_scores || jsonb_build_object(
            v_domain, jsonb_build_object(
                'score', v_score,
                'events', v_domain_events,
                'high_severity', v_high_count,
                'med_severity', v_med_count,
                'low_severity', v_low_count,
                'avg_confidence', ROUND(v_avg_confidence, 2)
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'scores', v_scores,
        'computed_at', NOW(),
        'workspace_id', p_workspace_id
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- 4. INTEGRATION STATUS VIEW
-- Quick lookup for frontend to determine what's connected
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_integration_status AS
SELECT
    workspace_id,
    jsonb_object_agg(integration_type, status) AS integrations,
    jsonb_object_agg(integration_type, last_sync_at) AS last_syncs,
    COUNT(*) FILTER (WHERE status = 'connected') AS connected_count,
    COUNT(*) AS total_count
FROM workspace_integrations
GROUP BY workspace_id;


-- ═══════════════════════════════════════════════════════════════
-- 5. GOVERNANCE EVENTS SUMMARY VIEW
-- Aggregated view for reports and dashboards
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_governance_summary AS
SELECT
    workspace_id,
    source_system,
    COUNT(*) AS event_count,
    COUNT(*) FILTER (WHERE confidence_score >= 0.8) AS high_confidence,
    COUNT(*) FILTER (WHERE confidence_score >= 0.5 AND confidence_score < 0.8) AS medium_confidence,
    COUNT(*) FILTER (WHERE confidence_score < 0.5) AS low_confidence,
    ROUND(AVG(confidence_score), 2) AS avg_confidence,
    MAX(signal_timestamp) AS latest_signal,
    MIN(signal_timestamp) AS earliest_signal
FROM governance_events
WHERE signal_timestamp > NOW() - INTERVAL '30 days'
GROUP BY workspace_id, source_system;


-- ═══════════════════════════════════════════════════════════════
-- 6. CONCENTRATION RISK FUNCTION
-- Computes revenue concentration from CRM deal events
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_concentration_risk(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_has_crm BOOLEAN := FALSE;
    v_event_count INT := 0;
    v_result JSONB;
BEGIN
    -- Check CRM connection
    SELECT EXISTS(
        SELECT 1 FROM workspace_integrations
        WHERE workspace_id = p_workspace_id
        AND integration_type = 'crm'
        AND status = 'connected'
    ) INTO v_has_crm;

    IF NOT v_has_crm THEN
        RETURN jsonb_build_object(
            'status', 'no_crm_integration',
            'has_data', false
        );
    END IF;

    -- Count deal-related events with signal references (client identifiers)
    SELECT COUNT(DISTINCT signal_reference) INTO v_event_count
    FROM governance_events
    WHERE workspace_id = p_workspace_id
    AND source_system = 'crm'
    AND signal_reference IS NOT NULL;

    RETURN jsonb_build_object(
        'status', 'computed',
        'has_data', v_event_count > 0,
        'unique_references', v_event_count,
        'computed_at', NOW()
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- 7. GRANTS — Allow authenticated users to call functions
-- ═══════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION compute_workforce_health(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_revenue_scenarios(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_insight_scores(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_concentration_risk(UUID) TO authenticated;
GRANT SELECT ON v_integration_status TO authenticated;
GRANT SELECT ON v_governance_summary TO authenticated;
