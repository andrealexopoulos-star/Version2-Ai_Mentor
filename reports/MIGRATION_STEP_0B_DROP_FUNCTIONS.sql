-- Drop ALL public functions to allow clean recreation
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT ns.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS func_sig
        FROM pg_proc p
        JOIN pg_namespace ns ON p.pronamespace = ns.oid
        WHERE ns.nspname = 'public'
    LOOP
        BEGIN
            EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_sig || ' CASCADE';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END $$;

-- Also drop intelligence_core functions
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT ns.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS func_sig
        FROM pg_proc p
        JOIN pg_namespace ns ON p.pronamespace = ns.oid
        WHERE ns.nspname = 'intelligence_core'
    LOOP
        BEGIN
            EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_sig || ' CASCADE';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END $$;
