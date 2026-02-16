#!/usr/bin/env python3
"""
HubSpot Merge.dev Connection Test - Custom OAuth
Tests the complete flow after configuring custom HubSpot OAuth in Merge
"""
import os
import sys
sys.path.insert(0, '/app/backend')

from dotenv import load_dotenv
from supabase import create_client
import httpx
import asyncio

load_dotenv('/app/backend/.env')

MERGE_API_KEY = os.environ.get('MERGE_API_KEY')
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print('='*70)
print('HUBSPOT MERGE.DEV CONNECTION TEST - CUSTOM OAUTH')
print('='*70)
print()

# Test 1: Verify Merge API Key
print('Test 1: Verify Merge API Key')
print('-'*70)

async def test_merge_api():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            'https://api.merge.dev/api/integrations/create-link-token',
            headers={
                'Authorization': f'Bearer {MERGE_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'end_user_origin_id': 'test-user',
                'end_user_organization_name': 'Test Org',
                'end_user_email_address': 'test@test.com',
                'categories': ['crm']
            }
        )
        return response.status_code, response.json()

status, data = asyncio.run(test_merge_api())
if status == 200:
    print('✅ Merge API Key is valid')
    print(f'   Link token: {data.get("link_token", "N/A")[:30]}...')
else:
    print(f'❌ Merge API Key failed: {status}')
    print(f'   Response: {data}')
    sys.exit(1)

print()

# Test 2: Check HubSpot Configuration in Merge
print('Test 2: HubSpot Integration Availability')
print('-'*70)

async def check_hubspot_in_merge():
    async with httpx.AsyncClient() as client:
        response = await client.get(
            'https://api.merge.dev/api/integrations',
            headers={'Authorization': f'Bearer {MERGE_API_KEY}'},
            follow_redirects=True
        )
        
        if response.status_code == 200:
            integrations = response.json()
            for integ in integrations:
                if 'hubspot' in integ.get('slug', '').lower():
                    return True, integ
        return False, None

found, hubspot = asyncio.run(check_hubspot_in_merge())
if found:
    print('✅ HubSpot is available in Merge')
    print(f'   Name: {hubspot.get("name")}')
    print(f'   Categories: {hubspot.get("categories")}')
else:
    print('❌ HubSpot not found in Merge integrations')
    print('   Check if CRM category is enabled in your Merge account')

print()

# Test 3: Check Workspace Setup
print('Test 3: Workspace Setup')
print('-'*70)

users = supabase.table('users').select('id, email, account_id').limit(5).execute()
accounts = supabase.table('accounts').select('*').execute()

print(f'✅ Workspaces: {len(accounts.data)}')
for acc in accounts.data:
    print(f'   - {acc["name"]} ({acc["id"]})')

print(f'✅ Users with workspaces: {sum(1 for u in users.data if u.get("account_id"))} / {len(users.data)}')

print()

# Test 4: Check Current Integrations
print('Test 4: Current Integrations')
print('-'*70)

integrations = supabase.table('integration_accounts').select('*').execute()

print(f'Total integrations: {len(integrations.data)}')
print()

hubspot_found = False
for integ in integrations.data:
    provider = integ.get('provider', 'unknown')
    category = integ.get('category', 'unknown')
    
    print(f'Provider: {provider} ({category})')
    print(f'  Workspace: {integ.get("account_id")}')
    print(f'  Merge Account ID: {integ.get("merge_account_id")}')
    print(f'  Has Token: {bool(integ.get("account_token"))}')
    print(f'  Connected: {integ.get("connected_at")}')
    print()
    
    if 'hubspot' in provider.lower():
        hubspot_found = True

if hubspot_found:
    print('✅ HubSpot integration found in database!')
else:
    print('⚠️  No HubSpot integration yet - needs to be connected via BIQC UI')

print()
print('='*70)
print('SUMMARY')
print('='*70)

if hubspot_found:
    print('✅ HubSpot is connected and workspace-scoped')
    print('✅ Ready for P1: Data fetching implementation')
else:
    print('NEXT STEPS:')
    print('1. Configure custom OAuth in Merge dashboard:')
    print('   - Client ID: 275da85b-1e52-4677-9fe7-5ce78800f8da')
    print('   - Client Secret: 6afd0d24-a5fc-409e-8811-84e12bcaf20e')
    print('2. Test connection via BIQC:')
    print('   - Navigate to /integrations')
    print('   - Click Connect on HubSpot')
    print('   - Complete OAuth flow')
    print('3. Run this script again to verify')

print()
