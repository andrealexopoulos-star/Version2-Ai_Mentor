-- ═══ BIQc POLICY CLEANUP — Run BEFORE the migration chunks ═══
-- This drops ALL existing policies on BIQc tables so migrations can recreate them cleanly.
-- Safe: only drops policies, not tables or data.

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Also drop policies in intelligence_core schema
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'intelligence_core'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Drop ALL existing public functions (so CREATE OR REPLACE works)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT routine_name, routine_schema
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_type = 'FUNCTION'
    ) LOOP
        BEGIN
            EXECUTE format('DROP FUNCTION IF EXISTS %I.%I CASCADE', r.routine_schema, r.routine_name);
        EXCEPTION WHEN OTHERS THEN
            NULL; -- skip if can't drop
        END;
    END LOOP;
END $$;
