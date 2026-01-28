"""
Workspace/Account Helper Functions for BIQC
Provides functions to manage workspace-scoped operations
"""
from typing import Optional, Dict, Any
from supabase import Client


async def get_or_create_user_account(supabase_client: Client, user_id: str, user_email: str, company_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Get or create an account (workspace) for a user.
    - If user already has account_id, return that account
    - If not, create a new workspace for the user
    
    Args:
        supabase_client: Supabase admin client
        user_id: UUID of the user
        user_email: Email of the user (for workspace naming)
        company_name: Optional company name for workspace
        
    Returns:
        Account dict with id, name, created_at
    """
    # First, check if user already has an account_id
    try:
        user_result = supabase_client.table('users').select('account_id').eq('id', user_id).single().execute()
        
        if user_result.data and user_result.data.get('account_id'):
            # User has account, fetch it
            account_id = user_result.data['account_id']
            account_result = supabase_client.table('accounts').select('*').eq('id', account_id).single().execute()
            
            if account_result.data:
                return account_result.data
        
        # User doesn't have account, create one
        workspace_name = company_name or f"{user_email}'s Workspace"
        
        # Create account
        account_data = {
            "name": workspace_name
        }
        account_result = supabase_client.table('accounts').insert(account_data).execute()
        
        if not account_result.data:
            raise Exception("Failed to create account")
        
        new_account = account_result.data[0]
        
        # Link user to account
        supabase_client.table('users').update({
            'account_id': new_account['id']
        }).eq('id', user_id).execute()
        
        return new_account
        
    except Exception as e:
        raise Exception(f"Failed to get or create account: {str(e)}")


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
