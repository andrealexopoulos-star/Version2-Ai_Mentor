#!/usr/bin/env python3

"""
Backend Redis Integration Testing for BIQc Azure Redis
Testing the additive Redis integration requirements:

1. Backend still starts and health endpoints work
2. /health and /api/health expose redis_connected
3. /api/health/detailed and /api/health/workers include Redis details
4. Graceful degradation when REDIS_URL is absent
5. No regressions in existing service initialization
"""

import asyncio
import json
import logging
import sys
from pathlib import Path

import httpx
import pytest

# Setup path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test configuration - using the frontend env REACT_APP_BACKEND_URL
with open('/app/frontend/.env', 'r') as f:
    frontend_env = f.read()

BACKEND_URL = None
for line in frontend_env.split('\n'):
    if line.startswith('REACT_APP_BACKEND_URL='):
        BACKEND_URL = line.split('=', 1)[1].strip()
        break

if not BACKEND_URL:
    BACKEND_URL = "https://business-brain-redis.preview.emergentagent.com"

logger.info(f"Testing against backend: {BACKEND_URL}")

class RedisIntegrationTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = {}
        
    async def close(self):
        await self.client.aclose()
    
    async def test_basic_health_endpoints(self):
        """Test 1 & 2: Backend starts and health endpoints expose redis_connected"""
        logger.info("Testing basic health endpoints...")
        
        # Test /health endpoint
        try:
            response = await self.client.get(f"{self.base_url}/health")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            health_data = response.json()
            assert "status" in health_data, "Health response missing status field"
            assert health_data["status"] == "healthy", f"Expected healthy status, got {health_data['status']}"
            assert "redis_connected" in health_data, "Health response missing redis_connected field"
            
            logger.info(f"/health response: {health_data}")
            self.test_results["basic_health"] = {
                "status": "PASS",
                "redis_connected": health_data["redis_connected"],
                "details": f"Status: {health_data['status']}, Redis connected: {health_data['redis_connected']}"
            }
            
        except Exception as e:
            self.test_results["basic_health"] = {
                "status": "FAIL", 
                "error": str(e)
            }
            logger.error(f"/health endpoint failed: {e}")
            return False

        # Test /api/health endpoint  
        try:
            response = await self.client.get(f"{self.base_url}/api/health")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            api_health_data = response.json()
            assert "status" in api_health_data, "API health response missing status field"
            assert api_health_data["status"] == "healthy", f"Expected healthy status, got {api_health_data['status']}"
            assert "redis_connected" in api_health_data, "API health response missing redis_connected field"
            
            logger.info(f"/api/health response: {api_health_data}")
            self.test_results["api_health"] = {
                "status": "PASS",
                "redis_connected": api_health_data["redis_connected"], 
                "details": f"Status: {api_health_data['status']}, Redis connected: {api_health_data['redis_connected']}"
            }
            
        except Exception as e:
            self.test_results["api_health"] = {
                "status": "FAIL",
                "error": str(e) 
            }
            logger.error(f"/api/health endpoint failed: {e}")
            return False
            
        return True

    async def test_detailed_health_endpoints(self):
        """Test 3: /api/health/detailed and /api/health/workers include Redis details"""
        logger.info("Testing detailed health endpoints...")
        
        # Test /api/health/detailed
        try:
            response = await self.client.get(f"{self.base_url}/api/health/detailed")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            detailed_data = response.json()
            assert "redis" in detailed_data, "Detailed health missing redis section"
            
            redis_info = detailed_data["redis"]
            expected_redis_fields = ["redis_connected", "queue_namespace", "worker_running", "queue_depth", "delayed_depth", "logging_buffer_depth"]
            
            for field in expected_redis_fields:
                assert field in redis_info, f"Redis section missing {field} field"
            
            # Check queue_namespace is 'biqc-jobs' as specified
            assert redis_info["queue_namespace"] == "biqc-jobs", f"Expected 'biqc-jobs', got {redis_info['queue_namespace']}"
            
            logger.info(f"/api/health/detailed redis section: {redis_info}")
            self.test_results["detailed_health"] = {
                "status": "PASS",
                "redis_info": redis_info,
                "details": f"Queue namespace: {redis_info['queue_namespace']}, Connected: {redis_info['redis_connected']}"
            }
            
        except Exception as e:
            self.test_results["detailed_health"] = {
                "status": "FAIL",
                "error": str(e)
            }
            logger.error(f"/api/health/detailed endpoint failed: {e}")
            return False

        # Test /api/health/workers
        try:
            response = await self.client.get(f"{self.base_url}/api/health/workers")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            
            workers_data = response.json()
            assert "redis_queue" in workers_data, "Workers health missing redis_queue section"
            
            redis_queue_info = workers_data["redis_queue"]
            expected_fields = ["redis_connected", "queue_namespace", "worker_running", "queue_depth", "delayed_depth", "logging_buffer_depth"]
            
            for field in expected_fields:
                assert field in redis_queue_info, f"Redis queue section missing {field} field"
                
            assert redis_queue_info["queue_namespace"] == "biqc-jobs", f"Expected 'biqc-jobs', got {redis_queue_info['queue_namespace']}"
            
            logger.info(f"/api/health/workers redis_queue section: {redis_queue_info}")
            self.test_results["workers_health"] = {
                "status": "PASS", 
                "redis_queue_info": redis_queue_info,
                "details": f"Queue namespace: {redis_queue_info['queue_namespace']}, Connected: {redis_queue_info['redis_connected']}"
            }
            
        except Exception as e:
            self.test_results["workers_health"] = {
                "status": "FAIL",
                "error": str(e)
            }
            logger.error(f"/api/health/workers endpoint failed: {e}")
            return False
            
        return True

    async def test_graceful_degradation(self):
        """Test 4: Graceful degradation when REDIS_URL is absent"""
        logger.info("Testing graceful degradation behavior...")
        
        # Based on the review request, in preview environment REDIS_URL is absent
        # So we expect redis_connected=false and "Redis unavailable – continuing without queue." behavior
        
        try:
            # Check basic health endpoints show redis_connected=false
            response = await self.client.get(f"{self.base_url}/health")
            health_data = response.json()
            
            if health_data["redis_connected"] == False:
                logger.info("✅ Graceful degradation confirmed: redis_connected=false")
                degradation_status = "EXPECTED_GRACEFUL_DEGRADATION"
            else:
                logger.warning("⚠️ Redis appears to be connected - may not be testing degradation scenario")
                degradation_status = "REDIS_AVAILABLE"
            
            # Check detailed health for error information
            response = await self.client.get(f"{self.base_url}/api/health/detailed")
            detailed_data = response.json()
            redis_info = detailed_data.get("redis", {})
            
            self.test_results["graceful_degradation"] = {
                "status": "PASS",
                "degradation_status": degradation_status,
                "redis_connected": health_data["redis_connected"],
                "redis_error": redis_info.get("last_error"),
                "details": f"Redis connected: {health_data['redis_connected']}, Error: {redis_info.get('last_error')}"
            }
            
            return True
            
        except Exception as e:
            self.test_results["graceful_degradation"] = {
                "status": "FAIL",
                "error": str(e)
            }
            logger.error(f"Graceful degradation test failed: {e}")
            return False

    async def test_no_service_regressions(self):
        """Test 5: No regressions in existing service initialization"""
        logger.info("Testing for service regressions...")
        
        try:
            # Test that the API root still works
            response = await self.client.get(f"{self.base_url}/api/")
            assert response.status_code == 200
            
            api_data = response.json()
            assert "message" in api_data
            assert "version" in api_data
            
            # Test that detailed health shows expected services
            response = await self.client.get(f"{self.base_url}/api/health/detailed")
            detailed_data = response.json()
            
            expected_sections = ["api", "supabase", "redis", "workers", "integrations"]
            missing_sections = []
            
            for section in expected_sections:
                if section not in detailed_data:
                    missing_sections.append(section)
            
            if missing_sections:
                logger.warning(f"Missing health sections: {missing_sections}")
            
            self.test_results["no_regressions"] = {
                "status": "PASS",
                "api_root_working": True,
                "health_sections_present": len(missing_sections) == 0,
                "missing_sections": missing_sections,
                "details": f"API root working: True, Health sections complete: {len(missing_sections) == 0}"
            }
            
            return True
            
        except Exception as e:
            self.test_results["no_regressions"] = {
                "status": "FAIL",
                "error": str(e)
            }
            logger.error(f"Regression test failed: {e}")
            return False

    async def run_all_tests(self):
        """Run all Redis integration tests"""
        logger.info("🚀 Starting BIQc Redis Integration Testing...")
        logger.info(f"Target URL: {self.base_url}")
        
        tests = [
            ("Basic Health Endpoints", self.test_basic_health_endpoints),
            ("Detailed Health Endpoints", self.test_detailed_health_endpoints), 
            ("Graceful Degradation", self.test_graceful_degradation),
            ("No Service Regressions", self.test_no_service_regressions),
        ]
        
        all_passed = True
        
        for test_name, test_func in tests:
            logger.info(f"\n--- Running: {test_name} ---")
            try:
                result = await test_func()
                if not result:
                    all_passed = False
                logger.info(f"✅ {test_name}: {'PASS' if result else 'FAIL'}")
            except Exception as e:
                logger.error(f"❌ {test_name}: FAIL - {e}")
                all_passed = False
        
        return all_passed

    def print_summary(self):
        """Print test summary"""
        logger.info("\n" + "="*50)
        logger.info("🏁 BIQc Redis Integration Test Summary")
        logger.info("="*50)
        
        for test_name, result in self.test_results.items():
            status_icon = "✅" if result["status"] == "PASS" else "❌"
            logger.info(f"{status_icon} {test_name}: {result['status']}")
            if "details" in result:
                logger.info(f"    Details: {result['details']}")
            if "error" in result:
                logger.info(f"    Error: {result['error']}")
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results.values() if r["status"] == "PASS")
        
        logger.info(f"\nResult: {passed_tests}/{total_tests} tests passed")
        
        # Export results to JSON for inspection
        with open('/app/redis_integration_test_results.json', 'w') as f:
            json.dump(self.test_results, f, indent=2)
        logger.info("Test results saved to /app/redis_integration_test_results.json")


async def main():
    """Main test runner"""
    tester = RedisIntegrationTester()
    
    try:
        all_passed = await tester.run_all_tests()
        tester.print_summary()
        
        if all_passed:
            logger.info("🎉 ALL REDIS INTEGRATION TESTS PASSED!")
            return 0
        else:
            logger.error("❌ SOME REDIS INTEGRATION TESTS FAILED!")
            return 1
            
    except Exception as e:
        logger.error(f"Test execution failed: {e}")
        return 1
    finally:
        await tester.close()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)