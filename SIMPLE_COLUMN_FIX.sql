-- SIMPLIFIED: Just Add Missing Columns
-- All tables exist, just need column additions

ALTER TABLE public.chat_history 
ADD COLUMN IF NOT EXISTS context_type TEXT;

ALTER TABLE public.business_profiles 
ADD COLUMN IF NOT EXISTS target_country TEXT DEFAULT 'Australia';

ALTER TABLE public.analyses 
ADD COLUMN IF NOT EXISTS analysis_type TEXT;

-- Verify changes
SELECT 
    'Columns added successfully' as status,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_history' AND column_name = 'context_type') as context_type_exists,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'business_profiles' AND column_name = 'target_country') as target_country_exists,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analyses' AND column_name = 'analysis_type') as analysis_type_exists;
