"""
URL CONFIGURATION - SINGLE SOURCE OF TRUTH (Backend)

This module provides fork-safe URL resolution for the backend.
ALL URL construction MUST use these functions to ensure fork independence.

CRITICAL: Never hardcode preview URLs anywhere in the codebase.
"""
import os
import re
import logging

logger = logging.getLogger(__name__)

def get_backend_url() -> str:
    """
    Get the backend URL from environment
    This is fork-safe and set by the deployment platform
    """
    url = os.environ.get('BACKEND_URL', 'http://localhost:8001')
    _assert_not_legacy_url(url)
    return url

def get_frontend_url() -> str:
    """
    Get the frontend URL from environment
    This is fork-safe and set by the deployment platform
    """
    url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
    _assert_not_legacy_url(url)
    return url

def get_oauth_redirect_uri(endpoint: str = '/api/auth/outlook/callback') -> str:
    """
    Construct OAuth redirect URI using FRONTEND_URL (custom domain).
    Always resolve against the public frontend domain used for OAuth callbacks.
    """
    frontend = get_frontend_url()
    return f"{frontend}{endpoint}"

def get_frontend_redirect_url(path: str = '/') -> str:
    """
    Construct frontend redirect URL
    
    Args:
        path: The frontend path to redirect to
        
    Returns:
        Full frontend URL
    """
    frontend = get_frontend_url()
    return f"{frontend}{path}"

def is_legacy_url(url: str) -> bool:
    """
    Check if a URL contains legacy fork names
    
    Args:
        url: URL to check
        
    Returns:
        True if URL contains legacy patterns
    """
    legacy_patterns = [
        r'advisor-chat-\d+',
        r'business-iq-\d+'
    ]
    
    return any(re.search(pattern, url) for pattern in legacy_patterns)

def _assert_not_legacy_url(url: str) -> None:
    """
    Assert that a URL is not a legacy fork URL
    Logs error in production, raises in development
    
    Args:
        url: URL to validate
        
    Raises:
        ValueError: If URL is a legacy fork URL (development only)
    """
    if is_legacy_url(url):
        error_msg = f"LEGACY URL DETECTED: {url}. Check environment variables."
        logger.error(error_msg)
        
        # In development, fail fast
        if os.environ.get('ENV') == 'development':
            raise ValueError(error_msg)

# Export configuration object for convenience
URL_CONFIG = {
    'BACKEND': get_backend_url(),
    'FRONTEND': get_frontend_url(),
}
