#!/usr/bin/env python3

"""
Test /api/files/generate with valid parameters to reproduce 500 error
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

async def test_files_generate_valid():
    """Test /api/files/generate with valid parameters"""
    async with httpx.AsyncClient(timeout=60.0) as client:
        
        # Authenticate
        auth_response = await client.post(
            f"{PRODUCTION_URL}/api/auth/supabase/login",
            json=TEST_CREDENTIALS
        )
        
        auth_data = auth_response.json()
        auth_token = auth_data.get("session", {}).get("access_token")
        client.headers["Authorization"] = f"Bearer {auth_token}"
        
        # Test valid file types
        test_payloads = [
            {
                "file_type": "logo",
                "prompt": "Simple business logo for consulting firm",
                "format": "png"
            },
            {
                "file_type": "document", 
                "prompt": "Business report summary",
                "format": "txt"
            },
            {
                "file_type": "report",
                "prompt": "Quarterly business analysis",
                "format": "pdf"
            }
        ]
        
        results = {}
        
        for i, payload in enumerate(test_payloads):
            try:
                logger.info(f"Testing payload {i+1}: {payload['file_type']}")
                response = await client.post(f"{PRODUCTION_URL}/api/files/generate", json=payload)
                
                logger.info(f"Status Code: {response.status_code}")
                logger.info(f"Response Text: {response.text[:300]}...")
                
                results[f"test_{i+1}_{payload['file_type']}"] = {
                    "status_code": response.status_code,
                    "response_text": response.text,
                    "payload": payload,
                    "timestamp": datetime.now().isoformat()
                }
                
                # If this is where the 500 error occurs, we want to capture it
                if response.status_code == 500:
                    logger.error(f"🔥 FOUND 500 ERROR on {payload['file_type']}: {response.text}")
                    
            except Exception as e:
                logger.error(f"Error testing {payload['file_type']}: {e}")
                results[f"test_{i+1}_{payload['file_type']}"] = {"error": str(e)}
        
        # Save results
        with open('/app/files_generate_comprehensive_test.json', 'w') as f:
            json.dump(results, f, indent=2)
        
        logger.info("Comprehensive test results saved to /app/files_generate_comprehensive_test.json")

if __name__ == "__main__":
    asyncio.run(test_files_generate_valid())