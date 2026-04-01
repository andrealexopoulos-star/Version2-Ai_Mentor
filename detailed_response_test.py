#!/usr/bin/env python3

"""
Follow-up test to examine specific response contents for better analysis
"""

import asyncio
import json
import logging
from datetime import datetime, timezone

import httpx

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PRODUCTION_URL = "https://biqc.ai"
TEST_CREDENTIALS = {
    "email": "andre@thestrategysquad.com.au",
    "password": "MasterMind2025*"
}

async def detailed_response_analysis():
    """Get detailed response content for analysis"""
    async with httpx.AsyncClient(timeout=60.0) as client:
        
        # Authenticate
        auth_response = await client.post(
            f"{PRODUCTION_URL}/api/auth/supabase/login",
            json=TEST_CREDENTIALS
        )
        
        auth_data = auth_response.json()
        auth_token = auth_data.get("session", {}).get("access_token")
        client.headers["Authorization"] = f"Bearer {auth_token}"
        
        # Test specific endpoints with detailed response capture
        test_cases = [
            ("POST", "/api/outlook/comprehensive-sync", {"force_refresh": False}),
            ("POST", "/api/files/generate", {"document_type": "report", "content_type": "business_summary"}),
            ("POST", "/api/marketing/benchmark", {"industry": "business_consulting"}),
        ]
        
        results = {}
        
        for method, endpoint, payload in test_cases:
            try:
                response = await client.post(f"{PRODUCTION_URL}{endpoint}", json=payload)
                
                try:
                    json_data = response.json()
                except:
                    json_data = {"raw_text": response.text}
                
                results[endpoint] = {
                    "status_code": response.status_code,
                    "response_text": response.text,
                    "response_json": json_data,
                    "headers": dict(response.headers)
                }
                
                logger.info(f"{endpoint}: {response.status_code} - {response.text[:200]}...")
                
            except Exception as e:
                results[endpoint] = {"error": str(e)}
                logger.error(f"{endpoint}: {e}")
        
        # Save detailed responses
        output_file = f"/app/detailed_responses_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        logger.info(f"Detailed responses saved to {output_file}")

if __name__ == "__main__":
    asyncio.run(detailed_response_analysis())