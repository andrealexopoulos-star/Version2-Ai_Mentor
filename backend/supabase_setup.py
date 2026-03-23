"""
Supabase Schema Setup and Migration Script

This script creates the PostgreSQL schema in Supabase for the application data model.
It handles schema creation, data migration, and validation.
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

def get_supabase_client() -> Client:
    """Initialize Supabase client with service role key"""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment")
    
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def create_schema():
    """Create PostgreSQL tables for core application collections"""
    
    supabase = get_supabase_client()
    
    # SQL schema definition
    schema_sql = """
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        full_name TEXT,
        company_name TEXT,
        industry TEXT,
        role TEXT,
        subscription_tier TEXT DEFAULT 'free',
        is_master_account BOOLEAN DEFAULT FALSE,
        microsoft_user_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Cognitive profiles table (4-layer persistent intelligence)
    CREATE TABLE IF NOT EXISTS cognitive_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        
        -- Layer 1: Immutable Reality (business facts)
        immutable_reality JSONB DEFAULT '{}'::jsonb,
        
        -- Layer 2: Behavioural Truth (observed actions)
        behavioural_truth JSONB DEFAULT '{}'::jsonb,
        
        -- Layer 3: Delivery Preference (communication style)
        delivery_preference JSONB DEFAULT '{}'::jsonb,
        
        -- Layer 4: Consequence & Outcome Memory
        consequence_memory JSONB DEFAULT '{}'::jsonb,
        
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        UNIQUE(user_id)
    );

    -- Advisory log (recommendations and advice tracking)
    CREATE TABLE IF NOT EXISTS advisory_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        agent_name TEXT NOT NULL,
        recommendation TEXT NOT NULL,
        context JSONB DEFAULT '{}'::jsonb,
        confidence_score FLOAT,
        acted_upon BOOLEAN DEFAULT FALSE,
        outcome TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        outcome_recorded_at TIMESTAMP WITH TIME ZONE
    );

    -- Soundboard conversations
    CREATE TABLE IF NOT EXISTS soundboard_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Soundboard messages
    CREATE TABLE IF NOT EXISTS soundboard_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES soundboard_conversations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Microsoft tokens (OAuth tokens for Outlook integration)
    CREATE TABLE IF NOT EXISTS microsoft_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        token_type TEXT DEFAULT 'Bearer',
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        scope TEXT,
        microsoft_user_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        UNIQUE(user_id)
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_microsoft_user_id ON users(microsoft_user_id);
    CREATE INDEX IF NOT EXISTS idx_cognitive_profiles_user_id ON cognitive_profiles(user_id);
    CREATE INDEX IF NOT EXISTS idx_advisory_log_user_id ON advisory_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_advisory_log_created_at ON advisory_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_soundboard_conversations_user_id ON soundboard_conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_soundboard_messages_conversation_id ON soundboard_messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_soundboard_messages_timestamp ON soundboard_messages(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_microsoft_tokens_user_id ON microsoft_tokens(user_id);

    -- Enable Row Level Security (RLS) - will be configured after auth setup
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE cognitive_profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE advisory_log ENABLE ROW LEVEL SECURITY;
    ALTER TABLE soundboard_conversations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE soundboard_messages ENABLE ROW LEVEL SECURITY;
    ALTER TABLE microsoft_tokens ENABLE ROW LEVEL SECURITY;
    """
    
    try:
        # Execute schema creation via Supabase REST API
        # Note: Direct SQL execution requires service role and may need to be done via Supabase dashboard SQL editor
        print("✅ Schema SQL generated successfully")
        print("\n" + "="*80)
        print("IMPORTANT: Copy the SQL below and execute it in Supabase SQL Editor")
        print("="*80 + "\n")
        print(schema_sql)
        print("\n" + "="*80)
        print("Instructions:")
        print("1. Go to your Supabase dashboard: https://supabase.com/dashboard")
        print("2. Select your project: The Strategy Squad aiV2")
        print("3. Click 'SQL Editor' in the left sidebar")
        print("4. Click 'New Query'")
        print("5. Copy and paste the SQL above")
        print("6. Click 'Run' to execute")
        print("="*80)
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_connection():
    """Test Supabase connection"""
    try:
        supabase = get_supabase_client()
        
        # Test with a simple query
        response = supabase.table('users').select('count', count='exact').execute()
        print(f"✅ Connection successful! Database ready.")
        print(f"   Current users count: {response.count if response.count else 0}")
        return True
        
    except Exception as e:
        print(f"❌ Connection test failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Supabase Schema Setup")
    print("="*80)
    
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        # Test connection only
        test_connection()
    else:
        # Generate schema SQL
        create_schema()
