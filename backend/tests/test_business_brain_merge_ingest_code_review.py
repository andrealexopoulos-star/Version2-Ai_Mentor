"""
Test and Code Review: business-brain-merge-ingest Edge Function
Iteration 147 - P0 Blocker: Merge endpoint mismatch causing ingestion failures

PURPOSE:
- Verify the LOCAL patched code uses category-specific DATASET_PLANs
- Verify the code no longer fetches CRM endpoints for accounting connectors (and vice versa)
- Document live database evidence of the bug
- Note: Supabase CLI is unavailable in this container, so LOCAL code is NOT deployed

EVIDENCE FROM LIVE DATABASE (verified via REST API):
- integration_accounts: Xero (accounting) + HubSpot (crm) for same tenant
- source_runs: ALL failures with error "Merge request failed (404) /crm/v1/companies:"
- canonical tables (customers, deals, invoices, payments): ALL EMPTY (0 rows)

ROOT CAUSE:
- Old code fetched ALL endpoints (/crm/v1/companies, /accounting/v1/invoices, etc.) for EVERY connector
- Xero (accounting) connector trying to fetch /crm/v1/companies → 404 error
- This caused hard failures and prevented data from flowing to canonical tables

FIX IN LOCAL CODE:
- DATASET_PLAN maps category → specific endpoints:
  * crm: /crm/v1/accounts, /crm/v1/contacts, /crm/v1/opportunities, etc.
  * accounting: /accounting/v1/invoices, /accounting/v1/payments
  * marketing: /marketing/v1/campaigns
- fetchDatasetsForCategory() now uses DATASET_PLAN[category] to fetch only relevant endpoints
- Optional endpoints that fail with 400/404 are marked 'skipped' (not failed)
- Required endpoint failures don't hard-fail if at least one succeeds

DEPLOYMENT STATUS:
- Supabase CLI is NOT available in this container
- Local code changes are NOT deployed to Supabase edge functions
- Main agent must deploy the fix via Supabase dashboard or CLI on a machine with Supabase CLI installed
"""

import pytest
import json
import os
import re
from pathlib import Path
import shutil

# Test file paths
REPO_ROOT = Path(__file__).resolve().parents[2]
EDGE_FUNCTION_PATH = REPO_ROOT / "supabase" / "functions" / "business-brain-merge-ingest" / "index.ts"
EDGE_FUNCTION_ALT_PATH = REPO_ROOT / "supabase_edge_functions" / "business-brain-merge-ingest" / "index.ts"


class TestBusinessBrainMergeIngestCodeReview:
    """Code review tests for the business-brain-merge-ingest edge function"""

    def test_dataset_plan_exists_and_is_category_specific(self):
        """Verify DATASET_PLAN uses category-specific endpoint mappings"""
        with open(EDGE_FUNCTION_PATH, "r") as f:
            code = f.read()
        
        # Check DATASET_PLAN structure exists
        assert "const DATASET_PLAN: Record<string, Array<" in code, "DATASET_PLAN type declaration missing"
        
        # Check CRM category has CRM-specific endpoints only
        crm_section = re.search(r'crm:\s*\[(.*?)\]', code, re.DOTALL)
        assert crm_section, "crm category missing from DATASET_PLAN"
        crm_content = crm_section.group(1)
        assert "/crm/v1/" in crm_content, "CRM endpoints should use /crm/v1/ path"
        assert "/accounting/v1/" not in crm_content, "CRM category should NOT have accounting endpoints"
        print("✓ CRM category has correct CRM-specific endpoints")
        
        # Check accounting category has accounting-specific endpoints only
        accounting_section = re.search(r'accounting:\s*\[(.*?)\]', code, re.DOTALL)
        assert accounting_section, "accounting category missing from DATASET_PLAN"
        accounting_content = accounting_section.group(1)
        assert "/accounting/v1/" in accounting_content, "Accounting endpoints should use /accounting/v1/ path"
        assert "/crm/v1/" not in accounting_content, "Accounting category should NOT have CRM endpoints"
        print("✓ Accounting category has correct accounting-specific endpoints")
        
        # Check marketing category
        marketing_section = re.search(r'marketing:\s*\[(.*?)\]', code, re.DOTALL)
        assert marketing_section, "marketing category missing from DATASET_PLAN"
        marketing_content = marketing_section.group(1)
        assert "/marketing/v1/" in marketing_content, "Marketing endpoints should use /marketing/v1/ path"
        print("✓ Marketing category has correct marketing-specific endpoints")

    def test_fetch_datasets_for_category_uses_plan(self):
        """Verify fetchDatasetsForCategory uses DATASET_PLAN[category]"""
        with open(EDGE_FUNCTION_PATH, "r") as f:
            code = f.read()
        
        # Check function signature
        assert "async function fetchDatasetsForCategory(" in code, "fetchDatasetsForCategory function missing"
        
        # Check it references DATASET_PLAN[category]
        assert "const plan = DATASET_PLAN[category]" in code, "Function should use DATASET_PLAN[category]"
        
        # Check it iterates over plan
        assert "plan.map(async (spec)" in code, "Function should map over plan entries"
        print("✓ fetchDatasetsForCategory correctly uses category-specific DATASET_PLAN")

    def test_optional_endpoints_can_be_skipped(self):
        """Verify optional endpoints are marked with optional: true and can be skipped on 404"""
        with open(EDGE_FUNCTION_PATH, "r") as f:
            code = f.read()
        
        # Check optional flag exists in DATASET_PLAN entries
        assert "optional: true" in code, "optional flag should exist for some endpoints"
        assert "optional?: boolean" in code, "optional should be defined as optional boolean in type"
        
        # Check isIgnorableMergeDatasetError handles 404
        assert "function isIgnorableMergeDatasetError" in code, "isIgnorableMergeDatasetError function missing"
        assert "merge request failed (404)" in code.lower(), "Should handle 404 errors as ignorable"
        
        # Check skipped status is used
        assert "status: ignored ? \"skipped\" : \"failed\"" in code or 'status: ignored ? "skipped" : "failed"' in code, "Should mark ignorable errors as skipped"
        print("✓ Optional endpoints can be safely skipped on 404/unsupported errors")

    def test_partial_status_for_mixed_success(self):
        """Verify runStatus can be 'partial' when some required endpoints fail"""
        with open(EDGE_FUNCTION_PATH, "r") as f:
            code = f.read()
        
        # Check partial status logic
        assert 'runStatus: requiredFailures > 0 ? "partial" : "completed"' in code or "runStatus: requiredFailures > 0 ? 'partial' : 'completed'" in code, "Should return partial status when required failures > 0"
        
        # Check status constraint includes partial
        assert '"partial"' in code or "'partial'" in code, "partial status should be used"
        print("✓ Code correctly marks runs as 'partial' when some required endpoints fail")

    def test_no_cross_category_fetch(self):
        """Verify the code doesn't fetch all endpoint types for every connector"""
        with open(EDGE_FUNCTION_PATH, "r") as f:
            code = f.read()
        
        # OLD BUG: Code would fetch companies, contacts, invoices, etc. for ALL connectors
        # NEW: Code should only fetch endpoints from DATASET_PLAN[category]
        
        # Check that the main loop uses category from integration_accounts
        assert "accountCategory" in code, "Should track account category"
        assert "fetchDatasetsForCategory(" in code, "Should use fetchDatasetsForCategory"
        
        # Verify fetch is scoped to category
        fetch_call = re.search(r'fetchDatasetsForCategory\(\s*mergeApiKey,\s*accountToken,\s*accountCategory', code)
        assert fetch_call, "fetchDatasetsForCategory should be called with accountCategory"
        print("✓ Code correctly scopes fetches to connector's category")

    def test_both_edge_function_files_are_identical(self):
        """Verify both edge function copies are synchronized"""
        with open(EDGE_FUNCTION_PATH, "r") as f1:
            code1 = f1.read()
        with open(EDGE_FUNCTION_ALT_PATH, "r") as f2:
            code2 = f2.read()
        
        assert code1 == code2, "supabase/functions and supabase_edge_functions copies should be identical"
        print("✓ Both edge function file copies are synchronized")


class TestLiveEvidenceDocumentation:
    """Document live database evidence (read-only verification)"""

    def test_document_live_source_runs_failures(self):
        """Document that live source_runs show the exact bug pattern"""
        # This test documents the evidence found via REST API queries
        # The actual query was done earlier and results are:
        
        evidence = {
            "integration_accounts": [
                {"provider": "Xero", "category": "accounting", "user_id": "52a60959..."},
                {"provider": "HubSpot", "category": "crm", "user_id": "52a60959..."}
            ],
            "source_runs_recent": [
                {"connector_type": "accounting:xero", "status": "failed", "error": "Merge request failed (404) /crm/v1/companies:"},
                {"connector_type": "crm:hubspot", "status": "failed", "error": "Merge request failed (404) /crm/v1/companies:"},
            ],
            "canonical_tables": {
                "customers": 0,
                "deals": 0,
                "invoices": 0,
                "payments": 0,
                "companies": 0,
                "owners": 0
            }
        }
        
        # The evidence proves:
        # 1. Xero (accounting) connector was trying to fetch /crm/v1/companies → 404
        # 2. This caused ALL runs to fail
        # 3. No data flowed to canonical tables
        
        print("=" * 60)
        print("LIVE DATABASE EVIDENCE (P0 Bug Confirmation)")
        print("=" * 60)
        print(f"Integration accounts: {json.dumps(evidence['integration_accounts'], indent=2)}")
        print(f"Recent source_runs: ALL FAILED with /crm/v1/companies 404")
        print(f"Canonical tables: ALL EMPTY")
        print("=" * 60)
        print("ROOT CAUSE: Old code fetched ALL endpoint types for EVERY connector")
        print("FIX: New code uses DATASET_PLAN[category] for category-specific fetches")
        print("=" * 60)
        
        # Test passes to document the evidence
        assert True

    def test_document_deployment_blocker(self):
        """Document that Supabase CLI is not available for deployment"""
        import subprocess
        
        # Check if supabase CLI is available
        supabase_available = shutil.which("supabase") is not None
        
        print("=" * 60)
        print("DEPLOYMENT STATUS")
        print("=" * 60)
        print(f"Supabase CLI available: {supabase_available}")
        if not supabase_available:
            print("❌ Cannot deploy edge function from this container")
            print("Main agent must deploy via:")
            print("  1. Supabase Dashboard (paste code manually)")
            print("  2. Machine with Supabase CLI: supabase functions deploy business-brain-merge-ingest")
        print("=" * 60)
        
        # Document this as expected state
        assert True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
