#!/usr/bin/env python3

"""
Production Backend Redis Queue Validation for BIQc

This test validates the Redis queue migration against the production backend at:
https://biqc.ai

Target validation:
1. /api/health, /api/health/workers, and /api/health/detailed Redis state
2. Queue-enabled routes behavior (queued/immediate or fallback inline):
   - POST /api/outlook/comprehensive-sync
   - POST /api/research/analyze-website
   - POST /api/marketing/benchmark
   - POST /api/ingestion/run
   - POST /api/ingestion/hybrid
   - POST /api/files/generate
3. Production blockers preventing queue model from operating

Credentials: andre@thestrategysquad.com.au / MasterMind2025*
"""

import asyncio
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Dict, Any, Optional

import httpx

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Production configuration
PRODUCTION_URL = "https://biqc.ai"
TEST_CREDENTIALS = {
    "email": "andre@thestrategysquad.com.au",
    "password": "MasterMind2025*"
}

class ProductionRedisQueueValidator:
    def __init__(self):
        self.base_url = PRODUCTION_URL
        self.client = httpx.AsyncClient(timeout=60.0)
        self.auth_token = None
        self.test_results = {}
        self.start_time = datetime.now(timezone.utc)
        
    async def close(self):
        await self.client.aclose()
    
    async def authenticate(self) -> bool:
        """Authenticate with production backend"""
        logger.info("🔐 Authenticating with production backend...")
        
        try:
            response = await self.client.post(
                f"{self.base_url}/api/auth/supabase/login",
                json=TEST_CREDENTIALS
            )
            
            if response.status_code != 200:
                self.test_results["authentication"] = {
                    "status": "FAIL",
                    "error": f"Auth failed with status {response.status_code}: {response.text}"
                }
                return False
            
            auth_data = response.json()
            self.auth_token = auth_data.get("session", {}).get("access_token")
            
            if not self.auth_token:
                self.test_results["authentication"] = {
                    "status": "FAIL", 
                    "error": "No access token in response"
                }
                return False
            
            # Set auth header for subsequent requests
            self.client.headers["Authorization"] = f"Bearer {self.auth_token}"
            
            self.test_results["authentication"] = {
                "status": "PASS",
                "user_id": auth_data.get("user", {}).get("id"),
                "details": f"Successfully authenticated user {auth_data.get('user', {}).get('id')}"
            }
            
            logger.info(f"✅ Authentication successful for user {auth_data.get('user', {}).get('id')}")
            return True
            
        except Exception as e:
            self.test_results["authentication"] = {
                "status": "FAIL",
                "error": str(e)
            }
            logger.error(f"❌ Authentication failed: {e}")
            return False

    async def test_health_endpoints(self):
        """Test health endpoints for Redis state"""
        logger.info("🏥 Testing health endpoints for Redis state...")
        
        health_tests = [
            ("/api/health", "basic_health"),
            ("/api/health/workers", "workers_health"), 
            ("/api/health/detailed", "detailed_health")
        ]
        
        for endpoint, test_key in health_tests:
            try:
                response = await self.client.get(f"{self.base_url}{endpoint}")
                
                if response.status_code != 200:
                    self.test_results[test_key] = {
                        "status": "FAIL",
                        "error": f"HTTP {response.status_code}: {response.text}"
                    }
                    continue
                
                data = response.json()
                
                # Extract Redis connection info
                if test_key == "basic_health":
                    redis_connected = data.get("redis_connected", False)
                    self.test_results[test_key] = {
                        "status": "PASS",
                        "redis_connected": redis_connected,
                        "details": f"Redis connected: {redis_connected}"
                    }
                    
                elif test_key == "workers_health":
                    redis_queue = data.get("redis_queue", {})
                    self.test_results[test_key] = {
                        "status": "PASS",
                        "redis_queue": redis_queue,
                        "details": f"Redis connected: {redis_queue.get('redis_connected')}, Queue namespace: {redis_queue.get('queue_namespace')}"
                    }
                    
                elif test_key == "detailed_health":
                    redis_info = data.get("redis", {})
                    self.test_results[test_key] = {
                        "status": "PASS", 
                        "redis": redis_info,
                        "details": f"Redis connected: {redis_info.get('redis_connected')}, Last error: {redis_info.get('last_error')}"
                    }
                
                logger.info(f"✅ {endpoint}: {self.test_results[test_key]['details']}")
                
            except Exception as e:
                self.test_results[test_key] = {
                    "status": "FAIL",
                    "error": str(e)
                }
                logger.error(f"❌ {endpoint} failed: {e}")

    async def test_queue_enabled_route(self, method: str, endpoint: str, payload: Optional[Dict] = None, test_name: str = None):
        """Test a queue-enabled route for queued/immediate behavior or fallback"""
        if not test_name:
            test_name = endpoint.replace("/api/", "").replace("/", "_")
            
        logger.info(f"⚡ Testing queue-enabled route: {method} {endpoint}")
        
        try:
            if method.upper() == "GET":
                response = await self.client.get(f"{self.base_url}{endpoint}")
            elif method.upper() == "POST":
                response = await self.client.post(f"{self.base_url}{endpoint}", json=payload or {})
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            # Check response
            response_data = {}
            try:
                response_data = response.json()
            except:
                response_data = {"raw_text": response.text}
            
            # Analyze response for queue behavior indicators
            queue_behavior = self._analyze_queue_behavior(response, response_data)
            
            self.test_results[test_name] = {
                "status": "PASS" if response.status_code < 500 else "FAIL",
                "http_status": response.status_code,
                "queue_behavior": queue_behavior,
                "response_size": len(response.text),
                "details": f"Status {response.status_code}, Behavior: {queue_behavior['type']}, Message: {queue_behavior.get('message', 'N/A')}"
            }
            
            logger.info(f"✅ {endpoint}: {self.test_results[test_name]['details']}")
            
        except Exception as e:
            self.test_results[test_name] = {
                "status": "FAIL",
                "error": str(e)
            }
            logger.error(f"❌ {endpoint} failed: {e}")

    def _analyze_queue_behavior(self, response, data: Dict) -> Dict[str, Any]:
        """Analyze response to determine queue behavior type"""
        response_text = response.text.lower()
        
        # Check for explicit queue/inline messages
        if "redis is unavailable" in response_text or "redis unavailable" in response_text:
            return {
                "type": "fallback_inline", 
                "reason": "redis_unavailable",
                "message": "Started inline because Redis is unavailable"
            }
        
        if "queued" in response_text or "queue" in response_text:
            return {
                "type": "queued",
                "reason": "redis_available", 
                "message": "Request queued for background processing"
            }
        
        # Check for immediate processing indicators
        if response.status_code == 200 and len(response.text) > 100:
            return {
                "type": "immediate",
                "reason": "synchronous_processing",
                "message": "Processed immediately (synchronous)"
            }
        
        # Check for server errors (like the known 500 on /api/files/generate)
        if response.status_code >= 500:
            return {
                "type": "error",
                "reason": "server_error",
                "message": f"Server error: {response.status_code}"
            }
        
        # Default analysis
        return {
            "type": "unknown",
            "reason": "indeterminate",
            "message": f"Could not determine behavior from response"
        }

    async def test_all_queue_routes(self):
        """Test all queue-enabled routes mentioned in the request"""
        logger.info("🚀 Testing all queue-enabled routes...")
        
        # Routes to test as specified in the request
        queue_routes = [
            ("POST", "/api/outlook/comprehensive-sync", {"force_refresh": False}),
            ("POST", "/api/research/analyze-website", {"url": "https://thestrategysquad.com.au"}),
            ("POST", "/api/marketing/benchmark", {"industry": "business_consulting"}),
            ("POST", "/api/ingestion/run", {}),
            ("POST", "/api/ingestion/hybrid", {}),
            ("POST", "/api/files/generate", {"document_type": "report", "content_type": "business_summary"})
        ]
        
        for method, endpoint, payload in queue_routes:
            await self.test_queue_enabled_route(method, endpoint, payload)

    async def run_comprehensive_validation(self):
        """Run complete production Redis queue validation"""
        logger.info("🎯 Starting Production Backend Redis Queue Validation")
        logger.info(f"Target: {self.base_url}")
        logger.info(f"Timestamp: {self.start_time.isoformat()}")
        
        # Step 1: Authentication
        auth_success = await self.authenticate()
        if not auth_success:
            logger.error("❌ Cannot proceed without authentication")
            return False
        
        # Step 2: Health endpoints
        await self.test_health_endpoints()
        
        # Step 3: Queue-enabled routes
        await self.test_all_queue_routes()
        
        return True

    def analyze_blockers(self) -> Dict[str, Any]:
        """Analyze test results to identify production blockers"""
        blockers = []
        
        # Check Redis connectivity
        basic_health = self.test_results.get("basic_health", {})
        if not basic_health.get("redis_connected", False):
            blockers.append({
                "type": "redis_connectivity",
                "severity": "critical",
                "description": "Redis is not connected in production",
                "evidence": basic_health.get("details", "Redis connection failed")
            })
        
        # Check for server errors in queue routes
        for test_name, result in self.test_results.items():
            if test_name.startswith("api_") and result.get("http_status", 0) >= 500:
                blockers.append({
                    "type": "route_failure", 
                    "severity": "critical",
                    "description": f"Route {test_name} returning server error",
                    "evidence": f"HTTP {result.get('http_status')}: {result.get('error', 'Unknown error')}"
                })
        
        # Check for Redis timeout errors
        detailed_health = self.test_results.get("detailed_health", {})
        redis_info = detailed_health.get("redis", {})
        if "timeout" in str(redis_info.get("last_error", "")).lower():
            blockers.append({
                "type": "redis_timeout",
                "severity": "critical", 
                "description": "Redis connection timeout in production",
                "evidence": redis_info.get("last_error", "Timeout error")
            })
        
        return {
            "total_blockers": len(blockers),
            "critical_blockers": len([b for b in blockers if b["severity"] == "critical"]),
            "blockers": blockers
        }

    def generate_summary(self) -> Dict[str, Any]:
        """Generate comprehensive test summary"""
        end_time = datetime.now(timezone.utc)
        duration = (end_time - self.start_time).total_seconds()
        
        # Count test results
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results.values() if r.get("status") == "PASS"])
        failed_tests = total_tests - passed_tests
        
        # Analyze blockers
        blocker_analysis = self.analyze_blockers()
        
        # Redis status summary
        redis_status = {
            "connected": self.test_results.get("basic_health", {}).get("redis_connected", False),
            "last_error": self.test_results.get("detailed_health", {}).get("redis", {}).get("last_error"),
            "queue_namespace": self.test_results.get("workers_health", {}).get("redis_queue", {}).get("queue_namespace")
        }
        
        return {
            "test_summary": {
                "target": self.base_url,
                "duration_seconds": round(duration, 2),
                "total_tests": total_tests,
                "passed": passed_tests,
                "failed": failed_tests,
                "timestamp": end_time.isoformat()
            },
            "redis_status": redis_status,
            "blocker_analysis": blocker_analysis,
            "detailed_results": self.test_results
        }

    def print_summary(self):
        """Print human-readable test summary"""
        summary = self.generate_summary()
        
        logger.info("\n" + "="*60)
        logger.info("🏁 PRODUCTION REDIS QUEUE VALIDATION SUMMARY")
        logger.info("="*60)
        
        # Test Results
        test_info = summary["test_summary"]
        logger.info(f"Target: {test_info['target']}")
        logger.info(f"Duration: {test_info['duration_seconds']}s")
        logger.info(f"Tests: {test_info['passed']}/{test_info['total_tests']} PASSED")
        
        # Redis Status
        redis = summary["redis_status"]
        redis_icon = "✅" if redis["connected"] else "❌"
        logger.info(f"{redis_icon} Redis Connected: {redis['connected']}")
        if redis["last_error"]:
            logger.info(f"   Last Error: {redis['last_error']}")
        if redis["queue_namespace"]:
            logger.info(f"   Queue Namespace: {redis['queue_namespace']}")
        
        # Blockers
        blockers = summary["blocker_analysis"]
        if blockers["total_blockers"] > 0:
            logger.info(f"\n🚫 PRODUCTION BLOCKERS DETECTED: {blockers['critical_blockers']} critical")
            for blocker in blockers["blockers"]:
                severity_icon = "🔥" if blocker["severity"] == "critical" else "⚠️"
                logger.info(f"{severity_icon} {blocker['type']}: {blocker['description']}")
                logger.info(f"   Evidence: {blocker['evidence']}")
        else:
            logger.info("\n✅ NO PRODUCTION BLOCKERS DETECTED")
        
        # Individual Test Results
        logger.info(f"\n📋 DETAILED TEST RESULTS:")
        for test_name, result in self.test_results.items():
            status_icon = "✅" if result["status"] == "PASS" else "❌"
            logger.info(f"{status_icon} {test_name}: {result['status']}")
            if "details" in result:
                logger.info(f"    {result['details']}")
            if "error" in result:
                logger.info(f"    Error: {result['error']}")
        
        # Save results
        output_file = f"/app/production_redis_validation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w') as f:
            json.dump(summary, f, indent=2)
        logger.info(f"\n💾 Results saved to {output_file}")


async def main():
    """Main test execution"""
    validator = ProductionRedisQueueValidator()
    
    try:
        success = await validator.run_comprehensive_validation()
        validator.print_summary()
        
        # Determine exit code based on critical blockers
        summary = validator.generate_summary()
        critical_blockers = summary["blocker_analysis"]["critical_blockers"]
        
        if critical_blockers > 0:
            logger.error(f"❌ VALIDATION FAILED: {critical_blockers} critical production blockers detected")
            return 1
        elif not success:
            logger.error("❌ VALIDATION FAILED: Test execution errors")
            return 1
        else:
            logger.info("🎉 VALIDATION PASSED: No critical production blockers")
            return 0
            
    except Exception as e:
        logger.error(f"❌ Validation execution failed: {e}")
        return 1
    finally:
        await validator.close()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)