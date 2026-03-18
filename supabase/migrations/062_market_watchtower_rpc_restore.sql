CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.compute_pressure_levels(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
        SELECT COUNT(*),
               COUNT(*) FILTER (WHERE confidence_score >= 0.7),
               COALESCE(AVG(confidence_score), 0)
        INTO v_event_count, v_high_count, v_avg_conf
        FROM public.governance_events
        WHERE workspace_id = p_workspace_id
          AND source_system = v_domain
          AND signal_timestamp > NOW() - INTERVAL '14 days';

        v_pressure_score := (v_high_count * 3.0) + (v_event_count * 0.5);

        v_pressure_level := CASE
            WHEN v_pressure_score >= 15 THEN 'critical'
            WHEN v_pressure_score >= 8 THEN 'elevated'
            WHEN v_pressure_score >= 3 THEN 'moderate'
            WHEN v_pressure_score > 0 THEN 'low'
            ELSE 'none'
        END;

        v_pressures := v_pressures || jsonb_build_object(
            v_domain,
            jsonb_build_object(
                'level', v_pressure_level,
                'score', ROUND(v_pressure_score, 1),
                'events_14d', v_event_count,
                'high_severity', v_high_count,
                'avg_confidence', ROUND(v_avg_conf, 2)
            )
        );
    END LOOP;

    RETURN jsonb_build_object('pressures', v_pressures, 'computed_at', NOW());
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_evidence_freshness(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
        SELECT MAX(signal_timestamp)
        INTO v_latest
        FROM public.governance_events
        WHERE workspace_id = p_workspace_id
          AND source_system = v_domain;

        IF v_latest IS NULL THEN
            v_freshness := v_freshness || jsonb_build_object(
                v_domain,
                jsonb_build_object('status', 'no_data', 'hours_old', NULL, 'decay_factor', 0, 'last_signal', NULL)
            );
            CONTINUE;
        END IF;

        v_hours_old := EXTRACT(EPOCH FROM (NOW() - v_latest)) / 3600.0;
        v_decay_factor := ROUND(EXP(-0.014 * v_hours_old)::NUMERIC, 3);

        v_status := CASE
            WHEN v_hours_old < 24 THEN 'fresh'
            WHEN v_hours_old < 72 THEN 'recent'
            WHEN v_hours_old < 168 THEN 'aging'
            ELSE 'stale'
        END;

        v_evidence_domain := COALESCE(v_domain_map ->> v_domain, v_domain);

        INSERT INTO public.evidence_freshness (
            id, user_id, domain, current_confidence, last_evidence_at, decay_rate, confidence_state, active
        )
        VALUES (
            gen_random_uuid(), p_workspace_id, v_evidence_domain,
            GREATEST(0.05, LEAST(1.0, v_decay_factor)),
            v_latest, 0.014, UPPER(v_status), true
        )
        ON CONFLICT (user_id, domain, active)
        DO UPDATE SET
            current_confidence = EXCLUDED.current_confidence,
            last_evidence_at = EXCLUDED.last_evidence_at,
            decay_rate = EXCLUDED.decay_rate,
            confidence_state = EXCLUDED.confidence_state,
            updated_at = NOW();

        v_freshness := v_freshness || jsonb_build_object(
            v_domain,
            jsonb_build_object(
                'status', v_status,
                'hours_old', ROUND(v_hours_old, 1),
                'decay_factor', v_decay_factor,
                'last_signal', v_latest
            )
        );
    END LOOP;

    RETURN jsonb_build_object('freshness', v_freshness, 'computed_at', NOW());
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_watchtower_positions(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_domain TEXT;
    v_positions JSONB := '{}'::JSONB;
    v_event_count INT;
    v_high_count INT;
    v_recent_count INT;
    v_position TEXT;
    v_velocity TEXT;
BEGIN
    FOR v_domain IN SELECT UNNEST(ARRAY['crm', 'accounting', 'marketing', 'email', 'scrape'])
    LOOP
        SELECT COUNT(*),
               COUNT(*) FILTER (WHERE confidence_score >= 0.7),
               COUNT(*) FILTER (WHERE signal_timestamp > NOW() - INTERVAL '3 days')
        INTO v_event_count, v_high_count, v_recent_count
        FROM public.governance_events
        WHERE workspace_id = p_workspace_id
          AND source_system = v_domain
          AND signal_timestamp > NOW() - INTERVAL '30 days';

        v_position := CASE
            WHEN v_high_count >= 5 THEN 'CRITICAL'
            WHEN v_high_count >= 3 OR (v_event_count >= 10 AND v_high_count >= 2) THEN 'COMPRESSION'
            WHEN v_event_count >= 5 AND v_high_count >= 1 THEN 'DRIFT'
            WHEN v_event_count > 0 THEN 'STABLE'
            ELSE 'NO_DATA'
        END;

        v_velocity := CASE
            WHEN v_recent_count > (v_event_count * 0.5) THEN 'accelerating'
            WHEN v_recent_count > (v_event_count * 0.2) THEN 'stable'
            WHEN v_event_count > 0 THEN 'decelerating'
            ELSE 'inactive'
        END;

        IF v_event_count > 0 THEN
            v_positions := v_positions || jsonb_build_object(
                v_domain,
                jsonb_build_object(
                    'position', v_position,
                    'velocity', v_velocity,
                    'events_30d', v_event_count,
                    'high_severity', v_high_count,
                    'recent_3d', v_recent_count
                )
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object('positions', v_positions, 'computed_at', NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_pressure_levels(UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.compute_evidence_freshness(UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.compute_watchtower_positions(UUID) TO authenticated, service_role, anon;