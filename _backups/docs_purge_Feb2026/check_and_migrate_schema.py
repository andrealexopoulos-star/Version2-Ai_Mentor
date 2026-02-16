#!/usr/bin/env python3
"""
Apply workspace-scoped integration migration to Supabase
This script uses environment variables to execute SQL via Supabase
"""
import os
import sys

# Add parent directory to path
sys.path.insert(0, '/app/backend')

from dotenv import load_dotenv
from supabase import create_client

# Load environment
load_dotenv('/app/backend/.env')

url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not url or not key:
    print('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    sys.exit(1)

print('=== CHECKING SCHEMA BEFORE MIGRATION ===\n')

supabase = create_client(url, key)

# Check users.account_id
print('1. Checking users.account_id...')
try:
    result = supabase.table('users').select('id, account_id').limit(1).execute()
    print('   ✅ Column EXISTS - skipping users.account_id creation')
    users_account_id_exists = True
except Exception as e:
    if 'does not exist' in str(e) or '42703' in str(e):
        print('   ⚠️  Column MISSING - needs to be added')
        users_account_id_exists = False
    else:
        print(f'   ❌ Error: {str(e)[:100]}')
        users_account_id_exists = False

# Check integration_accounts.account_id
print('\n2. Checking integration_accounts.account_id...')
try:
    result = supabase.table('integration_accounts').select('id, account_id').limit(1).execute()
    print('   ✅ Column EXISTS - skipping integration_accounts.account_id creation')
    integ_account_id_exists = True
except Exception as e:
    if 'does not exist' in str(e) or '42703' in str(e):
        print('   ⚠️  Column MISSING - needs to be added')
        integ_account_id_exists = False
    else:
        print(f'   ❌ Error: {str(e)[:100]}')
        integ_account_id_exists = False

# Check integration_accounts.merge_account_id
print('\n3. Checking integration_accounts.merge_account_id...')
try:
    result = supabase.table('integration_accounts').select('id, merge_account_id').limit(1).execute()
    print('   ✅ Column EXISTS - skipping integration_accounts.merge_account_id creation')
    integ_merge_id_exists = True
except Exception as e:
    if 'does not exist' in str(e) or '42703' in str(e):
        print('   ⚠️  Column MISSING - needs to be added')
        integ_merge_id_exists = False
    else:
        print(f'   ❌ Error: {str(e)[:100]}')
        integ_merge_id_exists = False

print('\n=== MIGRATION STATUS ===')
if users_account_id_exists and integ_account_id_exists and integ_merge_id_exists:
    print('✅ All required columns exist - no migration needed')
    print('Proceeding to code updates...')
else:
    print('⚠️  Schema migration required')
    print('\nRequired SQL (execute in Supabase SQL Editor):')
    print('-' * 60)
    with open('/app/supabase_migrations/add_workspace_scoped_integrations.sql', 'r') as f:
        print(f.read())
    print('-' * 60)
    print('\n❌ Cannot proceed with code updates until schema is migrated')
    print('Please execute the SQL above in Supabase Dashboard → SQL Editor')
