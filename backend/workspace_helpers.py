"""
Workspace/Account Helper Functions for BIQC
Provides functions to manage workspace-scoped operations
"""
from typing import Optional, Dict, Any
from supabase import Client


def _synthetic_account(user_id: str, user_email: str, company_name: Optional[str] = None) -> Dict[str, Any]:
    """Fallback workspace object using user_id when accounts table unavailable."""
    return {
        "id": user_id,
        "name": company_name or (user_email.split("@")[0] if user_email else "My Workspace"),
    }


async def get_or_create_user_account(supabase_client: Client, user_id: str, user_email: str, company_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Get or create an account (workspace) for a user.
    Falls back to using user_id as the workspace ID if accounts table unavailable.
    """
    try:
        user_result = supabase_client.table('users').select('account_id').eq('id', user_id).single().execute()

        if user_result.data and user_result.data.get('account_id'):
            account_id = user_result.data['account_id']
            account_result = supabase_client.table('accounts').select('*').eq('id', account_id).single().execute()
            if account_result.data:
                return account_result.data

        # Try to create an account
        workspace_name = company_name or (user_email.split("@")[0] if user_email else "My Workspace")
        try:
            account_result = supabase_client.table('accounts').insert({"name": workspace_name}).execute()
            if account_result.data:
                new_account = account_result.data[0]
                try:
                    supabase_client.table('users').update({'account_id': new_account['id']}).eq('id', user_id).execute()
                except Exception:
                    pass
                return new_account
        except Exception:
            pass

        # Deterministic fallback: persist a workspace keyed by user_id so
        # billing/account scope does not depend on an in-memory synthetic id.
        try:
            supabase_client.table('accounts').upsert({
                "id": user_id,
                "name": workspace_name,
                "owner_id": user_id,
            }).execute()
            supabase_client.table('users').update({'account_id': user_id}).eq('id', user_id).execute()
            account_result = supabase_client.table('accounts').select('*').eq('id', user_id).single().execute()
            if account_result.data:
                return account_result.data
        except Exception:
            pass
        return _synthetic_account(user_id, user_email, company_name)

    except Exception:
        return _synthetic_account(user_id, user_email, company_name)


async def get_user_account(supabase_client: Client, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get the account (workspace) for a user.
    
    Args:
        supabase_client: Supabase admin client
        user_id: UUID of the user
        
    Returns:
        Account dict or None if not found
    """
    try:
        user_result = supabase_client.table('users').select('account_id').eq('id', user_id).single().execute()
        
        if not user_result.data or not user_result.data.get('account_id'):
            return None
        
        account_id = user_result.data['account_id']
        account_result = supabase_client.table('accounts').select('*').eq('id', account_id).single().execute()
        
        return account_result.data if account_result.data else None
        
    except Exception as e:
        return None


async def get_account_integrations(supabase_client: Client, account_id: str) -> list:
    """
    Get all integrations for a workspace/account.
    
    Args:
        supabase_client: Supabase admin client
        account_id: UUID of the account/workspace
        
    Returns:
        List of integration records
    """
    try:
        result = supabase_client.table('integration_accounts').select('*').eq('account_id', account_id).execute()
        return result.data if result.data else []
    except Exception as e:
        return []


async def get_account_integration_by_category(supabase_client: Client, account_id: str, category: str) -> Optional[Dict[str, Any]]:
    """
    Get a specific integration for an account by category (e.g., 'crm', 'accounting').
    
    Args:
        supabase_client: Supabase admin client
        account_id: UUID of the account/workspace
        category: Integration category
        
    Returns:
        Integration record or None
    """
    try:
        result = supabase_client.table('integration_accounts').select('*').eq('account_id', account_id).eq('category', category).single().execute()
        return result.data if result.data else None
    except Exception as e:
        return None


async def get_merge_account_token(supabase_client: Client, account_id: str, category: str) -> Optional[str]:
    """
    Get Merge.dev Linked Account Token for a workspace and category.
    
    This token is used as X-Account-Token header for Merge Unified API calls.
    
    Args:
        supabase_client: Supabase admin client
        account_id: UUID of the workspace
        category: Integration category (e.g., 'crm', 'accounting')
        
    Returns:
        Merge Linked Account Token or None if not connected
    """
    integration = await get_account_integration_by_category(supabase_client, account_id, category)
    
    if not integration:
        return None
    
    # Return the Merge linked account token
    # This is stored in account_token field (from exchange-account-token endpoint)
    return integration.get('account_token')
