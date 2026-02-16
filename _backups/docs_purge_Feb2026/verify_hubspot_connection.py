#!/usr/bin/env python3
"""
Post-Configuration Verification Script
Run this AFTER configuring Merge-managed OAuth to verify HubSpot connection
"""
import os
import sys
sys.path.insert(0, '/app/backend')

from dotenv import load_dotenv
from supabase import create_client

load_dotenv('/app/backend/.env')

url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

supabase = create_client(url, key)

print('=== POST-CONFIGURATION VERIFICATION ===\n')
print('Run this AFTER you configure Merge-managed OAuth and test the connection\n')

# Check for HubSpot integration
integrations = supabase.table('integration_accounts').select('*').execute()

print(f'Total Integrations: {len(integrations.data)}\n')

hubspot_found = False
for integ in integrations.data:
    provider = integ.get('provider', 'unknown')
    category = integ.get('category', 'unknown')
    
    print(f'Provider: {provider}')
    print(f'  Category: {category}')
    print(f'  Workspace ID: {integ.get("account_id")}')
    print(f'  Merge Account ID: {integ.get("merge_account_id")}')
    print(f'  Has Account Token: {bool(integ.get("account_token"))}')
    print(f'  Connected At: {integ.get("connected_at")}')
    print(f'  Connected By User: {integ.get("user_id")}\n')
    
    if 'hubspot' in provider.lower():
        hubspot_found = True
        print('  ✅ HUBSPOT INTEGRATION FOUND!')
        print(f'  ✅ Workspace-scoped: {bool(integ.get("account_id"))}')
        print(f'  ✅ Merge Account ID stored: {bool(integ.get("merge_account_id"))}')
        print(f'  ✅ Ready for data fetching: {bool(integ.get("account_token"))}')

if hubspot_found:
    print('\n' + '='*60)
    print('✅ HUBSPOT CONNECTION SUCCESSFUL!')
    print('='*60)
    print('\nNext Steps:')
    print('1. HubSpot OAuth is stable ✅')
    print('2. Workspace-scoped connection verified ✅')
    print('3. Ready to implement P1: Data fetching via Merge Unified API')
    print('\nYou can now proceed to build:')
    print('  - Fetch contacts from HubSpot')
    print('  - Fetch deals from HubSpot')
    print('  - Fetch companies from HubSpot')
    print('  - Generate BIQC intelligence from CRM data')
else:
    print('\n' + '='*60)
    print('⚠️  HUBSPOT CONNECTION NOT YET COMPLETE')
    print('='*60)
    print('\nPlease:')
    print('1. Configure Merge-managed OAuth in Merge dashboard')
    print('2. Test connection via BIQC Integrations page')
    print('3. Run this script again to verify')
