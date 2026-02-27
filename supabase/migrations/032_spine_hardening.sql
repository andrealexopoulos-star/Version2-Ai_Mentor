-- ═══════════════════════════════════════════════════════════════
-- BIQc INTELLIGENCE SPINE — Hardening Migration
-- Migration: 032_spine_hardening.sql
--
-- Fixes:
-- 1. governance_events → APPEND-ONLY (no UPDATE/DELETE except emergency)
-- 2. Postgres-backed durable job queue (replaces in-memory queue)
-- 3. Event-to-snapshot correlation check function
-- 4. Feature flag cache-friendly query
--
-- ADDITIVE ONLY. No existing tables modified structurally.
-- Only RLS policy replacement on governance_events.
-- ═══════════════════════════════════════════════════════════════


-- ═══ 1. APPEND-ONLY ENFORCEMENT ON governance_events ═══

-- Drop the permissive service role policy
DROP POLICY IF EXISTS "Service role manages governance_events" ON governance_events;

-- Replace with INSERT-only for service role
CREATE POLICY "service_insert_governance_events" ON governance_events
    FOR INSERT TO service_role
    WITH CHECK (true);

-- Read access remains
-- "Users read own governance_events" already exists (FOR SELECT)

-- Emergency delete for super admin (via function only, not direct)
CREATE OR REPLACE FUNCTION emergency_delete_governance_event(p_event_id UUID, p_admin_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_admin_email != 'andre@thestrategysquad.com.au' THEN
        RAISE EXCEPTION 'Unauthorized: only super admin can delete governance events';
    END IF;
    
    -- Log the deletion as its own event BEFORE deleting
    INSERT INTO governance_events (workspace_id, event_type, source_system, signal_reference, signal_timestamp, confidence_score)
    SELECT workspace_id, 'EMERGENCY_DELETE', 'manual', p_event_id::TEXT, NOW(), 1.0
    FROM governance_events WHERE id = p_event_id;
    
    DELETE FROM governance_events WHERE id = p_event_id;
    RETURN true;
END;
$$;

-- Trigger to prevent UPDATE on governance_events
CREATE OR REPLACE FUNCTION prevent_governance_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'governance_events is append-only. UPDATE not permitted.';
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_governance_update ON governance_events;
CREATE TRIGGER trg_prevent_governance_update
    BEFORE UPDATE ON governance_events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_governance_update();


-- ═══ 2. DURABLE JOB QUEUE (Postgres-backed) ═══

CREATE TABLE IF NOT EXISTS ic_event_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    retry_count INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT now(),
    processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ic_queue_status ON ic_event_queue(status) WHERE status = 'pending';

-- Process queue function (called by pg_cron every minute)
CREATE OR REPLACE FUNCTION ic_process_event_queue()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item RECORD;
    v_count INT := 0;
BEGIN
    FOR v_item IN
        SELECT id, table_name, payload
        FROM ic_event_queue
        WHERE status = 'pending'
        ORDER BY created_at
        LIMIT 100
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            -- Mark as processing
            UPDATE ic_event_queue SET status = 'processing' WHERE id = v_item.id;
            
            -- Insert into target table
            IF v_item.table_name = 'ic_intelligence_events' THEN
                INSERT INTO ic_intelligence_events (tenant_id, event_type, object_id, model_name, numeric_payload, json_payload, confidence_score)
                SELECT 
                    (v_item.payload->>'tenant_id')::UUID,
                    v_item.payload->>'event_type',
                    (v_item.payload->>'object_id')::UUID,
                    v_item.payload->>'model_name',
                    (v_item.payload->>'numeric_payload')::FLOAT,
                    (v_item.payload->'json_payload')::JSONB,
                    (v_item.payload->>'confidence_score')::FLOAT;
            ELSIF v_item.table_name = 'ic_model_executions' THEN
                INSERT INTO ic_model_executions (model_name, model_version, tenant_id, execution_time_ms, confidence_score, output_summary)
                SELECT
                    v_item.payload->>'model_name',
                    v_item.payload->>'model_version',
                    (v_item.payload->>'tenant_id')::UUID,
                    (v_item.payload->>'execution_time_ms')::INT,
                    (v_item.payload->>'confidence_score')::FLOAT,
                    (v_item.payload->'output_summary')::JSONB;
            END IF;
            
            -- Mark completed
            UPDATE ic_event_queue SET status = 'completed', processed_at = now() WHERE id = v_item.id;
            v_count := v_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            UPDATE ic_event_queue 
            SET status = CASE WHEN retry_count >= 3 THEN 'failed' ELSE 'pending' END,
                retry_count = retry_count + 1,
                error_message = SQLERRM
            WHERE id = v_item.id;
        END;
    END LOOP;
    
    -- Cleanup completed items older than 24h
    DELETE FROM ic_event_queue WHERE status = 'completed' AND processed_at < now() - INTERVAL '24 hours';
    
    RETURN v_count;
END;
$$;

-- pg_cron: process queue every minute
-- SELECT cron.schedule('ic-process-queue', '* * * * *', $$SELECT ic_process_event_queue()$$);


-- ═══ 3. EVENT-TO-SNAPSHOT CORRELATION CHECK ═══

CREATE OR REPLACE FUNCTION ic_validate_snapshot_correlation(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_snap RECORD;
    v_correlations JSONB := '[]'::JSONB;
    v_events_before INT;
    v_valid INT := 0;
    v_invalid INT := 0;
BEGIN
    FOR v_snap IN
        SELECT snapshot_date, risk_score, engagement_score
        FROM ic_daily_metric_snapshots
        WHERE tenant_id = p_tenant_id
        ORDER BY snapshot_date DESC
        LIMIT 7
    LOOP
        -- Check for business events in 24h before snapshot
        SELECT COUNT(*) INTO v_events_before
        FROM governance_events
        WHERE workspace_id = p_tenant_id
        AND signal_timestamp >= (v_snap.snapshot_date - INTERVAL '24 hours')::TIMESTAMP
        AND signal_timestamp < (v_snap.snapshot_date + INTERVAL '1 day')::TIMESTAMP;
        
        IF v_events_before > 0 THEN
            v_valid := v_valid + 1;
        ELSE
            v_invalid := v_invalid + 1;
        END IF;
        
        v_correlations := v_correlations || jsonb_build_object(
            'date', v_snap.snapshot_date,
            'events_24h', v_events_before,
            'correlated', v_events_before > 0
        );
    END LOOP;
    
    RETURN jsonb_build_object(
        'valid_snapshots', v_valid,
        'uncorrelated_snapshots', v_invalid,
        'correlation_rate', CASE WHEN v_valid + v_invalid > 0 THEN ROUND(v_valid::NUMERIC / (v_valid + v_invalid), 2) ELSE 0 END,
        'details', v_correlations
    );
END;
$$;

GRANT EXECUTE ON FUNCTION ic_validate_snapshot_correlation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION emergency_delete_governance_event(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION ic_process_event_queue() TO postgres;

-- RLS on queue
ALTER TABLE ic_event_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_manage_queue" ON ic_event_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
