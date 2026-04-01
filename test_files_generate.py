#!/usr/bin/env python3

"""
Test /api/files/generate with proper parameters to reproduce 500 error
"""

import asyncio
import json
import logging
from datetime import datetime

import httpx

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PRODUCTION_URL = "https://biqc.ai"
TEST_CREDENTIALS = {
    "email": "andre@thestrategysquad.com.au",
    "password": "MasterMind2025*"
}

async def test_files_generate():
    """Test /api/files/generate with proper parameters"""
    async with httpx.AsyncClient(timeout=60.0) as client:
        
        # Authenticate
        auth_response = await client.post(
            f"{PRODUCTION_URL}/api/auth/supabase/login",
            json=TEST_CREDENTIALS
        )
        
        auth_data = auth_response.json()
        auth_token = auth_data.get("session", {}).get("access_token")
        client.headers["Authorization"] = f"Bearer {auth_token}"
        
        # Test /api/files/generate with proper payload
        payload = {
            "file_type": "pdf",
            "prompt": "Generate a business summary report"
        }
        
        try:
            response = await client.post(f"{PRODUCTION_URL}/api/files/generate", json=payload)
            
            logger.info(f"Status Code: {response.status_code}")
            logger.info(f"Response Text: {response.text}")
            
            result = {
                "status_code": response.status_code,
                "response_text": response.text,
                "headers": dict(response.headers),
                "timestamp": datetime.now().isoformat()
            }
            
            # Save result
            with open('/app/files_generate_test_result.json', 'w') as f:
                json.dump(result, f, indent=2)
            
            logger.info("Test result saved to /app/files_generate_test_result.json")
            
        except Exception as e:
            logger.error(f"Error testing /api/files/generate: {e}")

if __name__ == "__main__":
    asyncio.run(test_files_generate())