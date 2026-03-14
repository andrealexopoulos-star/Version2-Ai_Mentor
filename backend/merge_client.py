"""
Merge.dev Unified API Client
Authoritative integration pattern for accessing third-party CRM, Accounting, HR, and ATS data.

RULES:
1. BIQC never authenticates directly with providers (HubSpot, Salesforce, etc.)
2. Merge.dev is the single source of truth for OAuth and tokens
3. All requests use X-Account-Token header (Merge Linked Account Token)
4. Integration is workspace-scoped (not user-scoped)
5. No provider credentials stored in BIQC
"""

import os
import httpx
from typing import Optional, Dict, Any, List
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)


class MergeClient:
    """
    Merge.dev Unified API Client
    Handles all communication with Merge.dev on behalf of BIQC workspaces
    """
    
    BASE_URL = "https://api.merge.dev/api"
    
    def __init__(self, merge_api_key: Optional[str] = None):
        """
        Initialize Merge client with API key
        
        Args:
            merge_api_key: Merge.dev API key (from environment if not provided)
        """
        self.api_key = merge_api_key or os.environ.get("MERGE_API_KEY")
        
        if not self.api_key:
            raise ValueError("MERGE_API_KEY not configured")
        
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    async def _make_request(
        self,
        method: str,
        endpoint: str,
        account_token: str,
        params: Optional[Dict] = None,
        json: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Make authenticated request to Merge.dev Unified API
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint (e.g., '/crm/v1/contacts')
            account_token: Merge Linked Account Token (X-Account-Token)
            params: Query parameters
            json: Request body (for POST/PUT)
            
        Returns:
            Response data from Merge API
            
        Raises:
            HTTPException with appropriate status codes
        """
        url = f"{self.BASE_URL}{endpoint}"
        
        # Add X-Account-Token header (required for all Unified API calls)
        headers = {
            **self.headers,
            "X-Account-Token": account_token
        }
        
        logger.info(f"📡 Merge API: {method} {endpoint}")
        logger.info(f"   Using account_token: {account_token[:20]}...")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=json
                )
                
                logger.info(f"📊 Merge API response: {response.status_code}")
                
                # Handle errors
                if response.status_code == 401:
                    logger.error("❌ Merge API: Unauthorized - invalid account token")
                    raise HTTPException(
                        status_code=401,
                        detail="IntegrationAuthFailed: Merge account token is invalid or expired"
                    )
                
                if response.status_code == 403:
                    logger.error("❌ Merge API: Forbidden - insufficient permissions")
                    raise HTTPException(
                        status_code=403,
                        detail="IntegrationAuthFailed: Insufficient permissions"
                    )
                
                if response.status_code == 404:
                    logger.error("❌ Merge API: Not found")
                    raise HTTPException(
                        status_code=404,
                        detail="IntegrationResourceNotFound: Resource not found in provider"
                    )
                
                if response.status_code >= 500:
                    logger.error(f"❌ Merge API: Server error {response.status_code}")
                    raise HTTPException(
                        status_code=502,
                        detail="IntegrationUpstreamError: Merge.dev service error"
                    )
                
                if response.status_code >= 400:
                    error_text = response.text
                    logger.error(f"❌ Merge API error: {error_text}")
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"IntegrationUpstreamError: {error_text}"
                    )
                
                return response.json()
                
        except httpx.TimeoutException:
            logger.error("❌ Merge API: Timeout")
            raise HTTPException(
                status_code=504,
                detail="IntegrationUpstreamError: Merge.dev request timeout"
            )
        except httpx.HTTPError as e:
            logger.error(f"❌ Merge API: HTTP error {str(e)}")
            raise HTTPException(
                status_code=502,
                detail=f"IntegrationUpstreamError: Network error - {str(e)}"
            )
    
    # ==================== CRM ENDPOINTS ====================
    
    async def get_contacts(
        self,
        account_token: str,
        cursor: Optional[str] = None,
        page_size: int = 100
    ) -> Dict[str, Any]:
        """
        Get contacts from CRM (HubSpot, Salesforce, etc.) via Merge.dev
        
        Args:
            account_token: Merge Linked Account Token
            cursor: Pagination cursor
            page_size: Number of records per page
            
        Returns:
            {
                "results": [...],
                "next": "cursor_for_next_page",
                "previous": null
            }
        """
        params = {"page_size": page_size}
        if cursor:
            params["cursor"] = cursor
        
        return await self._make_request(
            "GET",
            "/crm/v1/contacts",
            account_token,
            params=params
        )
    
    async def get_companies(
        self,
        account_token: str,
        cursor: Optional[str] = None,
        page_size: int = 100
    ) -> Dict[str, Any]:
        """
        Get companies from CRM via Merge.dev
        """
        params = {"page_size": page_size}
        if cursor:
            params["cursor"] = cursor
        
        return await self._make_request(
            "GET",
            "/crm/v1/companies",
            account_token,
            params=params
        )
    
    # ==================== FILE STORAGE ENDPOINTS ====================
    
    async def get_files(
        self,
        account_token: str,
        cursor: Optional[str] = None,
        page_size: int = 100
    ) -> Dict[str, Any]:
        """
        Get files from File Storage (Google Drive, OneDrive, etc.) via Merge.dev
        
        Args:
            account_token: Merge Linked Account Token
            cursor: Pagination cursor
            page_size: Number of files per page
            
        Returns:
            {
                "results": [...],
                "next": "cursor_for_next_page"
            }
        """
        params = {"page_size": page_size}
        if cursor:
            params["cursor"] = cursor
        
        return await self._make_request(
            "GET",
            "/filestorage/v1/files",
            account_token,
            params=params
        )
    
    async def get_folders(
        self,
        account_token: str,
        cursor: Optional[str] = None,
        page_size: int = 100
    ) -> Dict[str, Any]:
        """
        Get folders from File Storage via Merge.dev
        """
        params = {"page_size": page_size}
        if cursor:
            params["cursor"] = cursor
        
        return await self._make_request(
            "GET",
            "/filestorage/v1/folders",
            account_token,
            params=params
        )
    
    async def get_file_metadata(
        self,
        account_token: str,
        file_id: str
    ) -> Dict[str, Any]:
        """
        Get specific file metadata from File Storage
        """
        return await self._make_request(
            "GET",
            f"/filestorage/v1/files/{file_id}",
            account_token
        )
    
    # ==================== CRM ENDPOINTS ====================
    
    async def get_deals(
        self,
        account_token: str,
        cursor: Optional[str] = None,
        page_size: int = 100
    ) -> Dict[str, Any]:
        """
        Get deals/opportunities from CRM via Merge.dev
        """
        params = {"page_size": page_size}
        if cursor:
            params["cursor"] = cursor
        
        return await self._make_request(
            "GET",
            "/crm/v1/opportunities",
            account_token,
            params=params
        )
    
    async def get_users(
        self,
        account_token: str,
        cursor: Optional[str] = None,
        page_size: int = 100
    ) -> Dict[str, Any]:
        """
        Get CRM users/owners via Merge.dev
        """
        params = {"page_size": page_size}
        if cursor:
            params["cursor"] = cursor
        
        return await self._make_request(
            "GET",
            "/crm/v1/users",
            account_token,
            params=params
        )

    # ==================== TICKETING ENDPOINTS ====================

    async def get_ticketing_users(
        self,
        account_token: str,
        cursor: Optional[str] = None,
        page_size: int = 100
    ) -> Dict[str, Any]:
        """
        Get ticketing users from Merge Unified API (Jira, Asana, etc).
        """
        params = {"page_size": page_size}
        if cursor:
            params["cursor"] = cursor

        return await self._make_request(
            "GET",
            "/ticketing/v1/users",
            account_token,
            params=params,
        )

    async def get_ticketing_collections(
        self,
        account_token: str,
        cursor: Optional[str] = None,
        page_size: int = 100
    ) -> Dict[str, Any]:
        """
        Get ticketing collections (projects/boards) from Merge Unified API.
        """
        params = {"page_size": page_size}
        if cursor:
            params["cursor"] = cursor

        return await self._make_request(
            "GET",
            "/ticketing/v1/collections",
            account_token,
            params=params,
        )

    async def create_ticket(
        self,
        account_token: str,
        model: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Create ticket/task through Merge ticketing Unified API.
        """
        return await self._make_request(
            "POST",
            "/ticketing/v1/tickets",
            account_token,
            json={"model": model},
        )


    # ==================== ACCOUNTING ENDPOINTS ====================
    
    async def get_invoices(
        self,
        account_token: str,
        cursor: Optional[str] = None,
        page_size: int = 100
    ) -> Dict[str, Any]:
        """
        Get invoices from accounting system (Xero, QuickBooks, etc.) via Merge.dev
        
        Returns:
            {
                "results": [...invoices...],
                "next": "cursor_for_next_page",
                "previous": null
            }
        """
        params = {"page_size": page_size}
        if cursor:
            params["cursor"] = cursor
        
        return await self._make_request(
            "GET",
            "/accounting/v1/invoices",
            account_token,
            params=params
        )
    
    async def get_payments(
        self,
        account_token: str,
        cursor: Optional[str] = None,
        page_size: int = 100
    ) -> Dict[str, Any]:
        """
        Get payments from accounting system via Merge.dev
        """
        params = {"page_size": page_size}
        if cursor:
            params["cursor"] = cursor
        
        return await self._make_request(
            "GET",
            "/accounting/v1/payments",
            account_token,
            params=params
        )
    
    async def get_transactions(
        self,
        account_token: str,
        cursor: Optional[str] = None,
        page_size: int = 100
    ) -> Dict[str, Any]:
        """
        Get transactions from accounting system via Merge.dev
        """
        params = {"page_size": page_size}
        if cursor:
            params["cursor"] = cursor
        
        return await self._make_request(
            "GET",
            "/accounting/v1/transactions",
            account_token,
            params=params
        )
    
    # ==================== CRM ACTIVITIES ====================
    
    async def get_notes(
        self,
        account_token: str,
        cursor: Optional[str] = None,
        page_size: int = 100
    ) -> Dict[str, Any]:
        """
        Get notes/activities from CRM via Merge.dev
        """
        params = {"page_size": page_size}
        if cursor:
            params["cursor"] = cursor
        
        return await self._make_request(
            "GET",
            "/crm/v1/notes",
            account_token,
            params=params
        )


# Singleton instance
_merge_client: Optional[MergeClient] = None


def get_merge_client() -> MergeClient:
    """
    Get or create Merge client singleton
    """
    global _merge_client
    
    if _merge_client is None:
        _merge_client = MergeClient()
    
    return _merge_client
