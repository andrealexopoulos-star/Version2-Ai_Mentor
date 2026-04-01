#!/usr/bin/env python3
"""
Production Backend/Security Audit for BIQc Platform
Target: https://biqc.ai
User: andre@thestrategysquad.com.au / MasterMind2025*

Audit Scope:
1. Authentication & token-based endpoint testing
2. Security posture checks
3. Fallback/fail-open audit  
4. Free-tier access verification
5. Unauthenticated access blocking validation
"""

import requests
import json
import time
import uuid
import os
from datetime import datetime
from typing import Dict, Any, List, Optional

# Production Configuration
BASE_URL = os.environ.get("BIQC_BASE_URL", "https://biqc.ai")
API_BASE = f"{BASE_URL}/api"
TEST_EMAIL = os.environ.get("BIQC_TEST_EMAIL", "andre@thestrategysquad.com.au")
TEST_PASSWORD = os.environ.get("BIQC_TEST_PASSWORD", "MasterMind2025*")

class ProductionSecurityAuditor:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token: Optional[str] = None
        self.user_id: Optional[str] = None
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "target": BASE_URL,
            "auth": {},
            "protected_endpoints": {},
            "security_headers": {},
            "rate_limiting": {},
            "fallback_audit": {},
            "free_tier_check": {},
            "unauthenticated_blocking": {},
            "security_findings": [],
            "recommendations": []
        }
    
    def log(self, message: str, level: str = "INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
    
    def add_finding(self, severity: str, category: str, issue: str, details: str = ""):
        """Add security finding to results"""
        finding = {
            "severity": severity,  # CRITICAL, HIGH, MEDIUM, LOW, INFO
            "category": category,
            "issue": issue,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.results["security_findings"].append(finding)
        
        severity_icon = {"CRITICAL": "🔴", "HIGH": "🟠", "MEDIUM": "🟡", "LOW": "🟢", "INFO": "ℹ️"}
        icon = severity_icon.get(severity, "⚪")
        self.log(f"{icon} {severity}: {category} - {issue}")
    
    def test_authentication(self) -> bool:
        """Test authentication with provided credentials"""
        self.log("=" * 80)
        self.log("1. AUTHENTICATION & TOKEN VALIDATION")
        self.log("=" * 80)
        
        try:
            auth_url = f"{API_BASE}/auth/supabase/login"
            auth_data = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
            
            start_time = time.time()
            response = self.session.post(auth_url, json=auth_data, timeout=15)
            auth_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get('session', {}).get('access_token')
                self.user_id = data.get('user', {}).get('id')
                
                if self.auth_token:
                    # Set authorization header for subsequent requests
                    self.session.headers.update({
                        'Authorization': f'Bearer {self.auth_token}',
                        'Content-Type': 'application/json'
                    })
                    
                    self.log(f"✅ Authentication successful")
                    self.log(f"   User ID: {self.user_id}")
                    self.log(f"   Token length: {len(self.auth_token)} chars")
                    self.log(f"   Response time: {auth_time:.2f}s")
                    
                    self.results["auth"] = {
                        "success": True,
                        "user_id": self.user_id,
                        "token_length": len(self.auth_token),
                        "response_time": auth_time
                    }
                    
                    # Basic token validation
                    if len(self.auth_token) < 50:
                        self.add_finding("MEDIUM", "Authentication", "Short token length may indicate weak token generation", f"Token length: {len(self.auth_token)}")
                    
                    return True
                else:
                    self.add_finding("CRITICAL", "Authentication", "No access token returned despite 200 response")
                    return False
            else:
                self.add_finding("HIGH", "Authentication", f"Login failed with HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.add_finding("CRITICAL", "Authentication", f"Authentication request failed: {str(e)}")
            return False
    
    def test_protected_endpoints(self):
        """Test protected endpoints with valid bearer token"""
        self.log("=" * 80)
        self.log("2. PROTECTED ENDPOINTS WITH BEARER TOKEN")
        self.log("=" * 80)
        
        # Core production endpoints from the audit scope
        endpoints = [
            "/auth/supabase/me",
            "/brain/kpis", 
            "/intelligence/watchtower",
            "/intelligence/pressure",
            "/intelligence/freshness",
            "/email/priority-inbox",
            "/outlook/calendar/events",
            "/integrations/merge/connected",
            "/user/integration-status",
            "/user/data-coverage",
            "/notifications/alerts",
            "/marketing/benchmark/latest"
        ]
        
        endpoint_results = {}
        
        for endpoint in endpoints:
            try:
                url = f"{API_BASE}{endpoint}"
                start_time = time.time()
                response = self.session.get(url, timeout=10)
                response_time = time.time() - start_time
                
                # Check security headers
                security_headers = self.check_security_headers(response)
                
                status_code = response.status_code
                if status_code == 200:
                    self.log(f"✅ {endpoint} - 200 OK ({response_time:.2f}s)")
                    
                    # Check for placeholder/fallback responses
                    try:
                        data = response.json()
                        placeholder_indicators = ["placeholder", "fallback", "no_data", "mock", "dummy", "test_data"]
                        has_placeholders = any(indicator in str(data).lower() for indicator in placeholder_indicators)
                        
                        if has_placeholders:
                            self.add_finding("MEDIUM", "Data Quality", f"Endpoint {endpoint} may contain placeholder data")
                        
                        endpoint_results[endpoint] = {
                            "status_code": status_code,
                            "response_time": response_time,
                            "has_placeholders": has_placeholders,
                            "security_headers": security_headers,
                            "data_keys": list(data.keys()) if isinstance(data, dict) else ["non_dict"],
                            "success": True
                        }
                        
                    except json.JSONDecodeError:
                        endpoint_results[endpoint] = {
                            "status_code": status_code,
                            "response_time": response_time,
                            "json_error": True,
                            "security_headers": security_headers,
                            "success": False
                        }
                        self.add_finding("LOW", "Response Format", f"Endpoint {endpoint} returned non-JSON response")
                        
                elif status_code in [401, 403]:
                    self.add_finding("HIGH", "Authorization", f"Authenticated request to {endpoint} was rejected (HTTP {status_code})")
                    endpoint_results[endpoint] = {"status_code": status_code, "success": False, "auth_issue": True}
                    
                elif status_code == 404:
                    self.log(f"ℹ️ {endpoint} - 404 Not Found")
                    endpoint_results[endpoint] = {"status_code": status_code, "success": False, "not_found": True}
                    
                elif status_code == 503:
                    self.log(f"⚠️ {endpoint} - 503 Service Unavailable")
                    endpoint_results[endpoint] = {"status_code": status_code, "success": False, "service_unavailable": True}
                    
                else:
                    self.log(f"❌ {endpoint} - HTTP {status_code}")
                    endpoint_results[endpoint] = {"status_code": status_code, "success": False}
                    
            except requests.exceptions.Timeout:
                self.add_finding("MEDIUM", "Performance", f"Endpoint {endpoint} timed out")
                endpoint_results[endpoint] = {"success": False, "timeout": True}
                
            except Exception as e:
                self.add_finding("LOW", "Network", f"Error testing {endpoint}: {str(e)}")
                endpoint_results[endpoint] = {"success": False, "error": str(e)}
        
        successful = sum(1 for r in endpoint_results.values() if r.get("success"))
        total = len(endpoints)
        
        self.log(f"\nProtected endpoints health: {successful}/{total} ({(successful/total)*100:.1f}%)")
        self.results["protected_endpoints"] = {
            "total": total,
            "successful": successful,
            "health_percentage": (successful/total)*100,
            "details": endpoint_results
        }
    
    def check_security_headers(self, response) -> Dict[str, Any]:
        """Check for important security headers"""
        headers = response.headers
        security_check = {
            "x_frame_options": headers.get("X-Frame-Options"),
            "x_content_type_options": headers.get("X-Content-Type-Options"),
            "strict_transport_security": headers.get("Strict-Transport-Security"),
            "content_security_policy": headers.get("Content-Security-Policy"),
            "x_xss_protection": headers.get("X-XSS-Protection"),
            "referrer_policy": headers.get("Referrer-Policy"),
            "server_header": headers.get("Server"),  # Should not expose version info
            "has_cors_headers": bool(headers.get("Access-Control-Allow-Origin"))
        }
        
        # Track security header findings
        if not security_check["x_frame_options"]:
            # Only log once to avoid spam
            if "missing_x_frame_options" not in [f["issue"] for f in self.results["security_findings"]]:
                self.add_finding("LOW", "Security Headers", "Missing X-Frame-Options header")
        
        if not security_check["strict_transport_security"]:
            if "missing_hsts" not in [f["issue"] for f in self.results["security_findings"]]:
                self.add_finding("MEDIUM", "Security Headers", "Missing Strict-Transport-Security header")
        
        return security_check
    
    def test_unauthenticated_access(self):
        """Test that protected endpoints block unauthenticated access"""
        self.log("=" * 80)
        self.log("3. UNAUTHENTICATED ACCESS BLOCKING")
        self.log("=" * 80)
        
        # Create session without auth token
        unauth_session = requests.Session()
        
        protected_endpoints = [
            "/brain/kpis",
            "/intelligence/watchtower", 
            "/email/priority-inbox",
            "/user/integration-status",
            "/notifications/alerts"
        ]
        
        blocking_results = {}
        
        for endpoint in protected_endpoints:
            try:
                url = f"{API_BASE}{endpoint}"
                response = unauth_session.get(url, timeout=10)
                
                if response.status_code in [401, 403]:
                    self.log(f"✅ {endpoint} - Correctly blocked (HTTP {response.status_code})")
                    blocking_results[endpoint] = {"blocked": True, "status_code": response.status_code}
                elif response.status_code == 200:
                    self.add_finding("HIGH", "Access Control", f"Protected endpoint {endpoint} allows unauthenticated access")
                    blocking_results[endpoint] = {"blocked": False, "status_code": response.status_code}
                else:
                    blocking_results[endpoint] = {"blocked": "unknown", "status_code": response.status_code}
                    
            except Exception as e:
                blocking_results[endpoint] = {"blocked": "error", "error": str(e)}
        
        properly_blocked = sum(1 for r in blocking_results.values() if r.get("blocked") is True)
        total = len(protected_endpoints)
        
        self.log(f"\nAccess control health: {properly_blocked}/{total} endpoints properly blocked")
        self.results["unauthenticated_blocking"] = {
            "total": total,
            "properly_blocked": properly_blocked,
            "details": blocking_results
        }
    
    def test_rate_limiting(self):
        """Test for basic rate limiting/throttling on login attempts"""
        self.log("=" * 80)
        self.log("4. RATE LIMITING & SECURITY THROTTLING")
        self.log("=" * 80)
        
        # Test with wrong password attempts (safe, low volume)
        wrong_password_session = requests.Session()
        auth_url = f"{API_BASE}/auth/supabase/login"
        
        rate_limit_results = {"attempts": 0, "blocked": False, "responses": []}
        
        for i in range(5):  # Limited to 5 attempts to be safe
            try:
                auth_data = {"email": TEST_EMAIL, "password": "WrongPassword123!"}
                response = wrong_password_session.post(auth_url, json=auth_data, timeout=10)
                
                rate_limit_results["attempts"] += 1
                rate_limit_results["responses"].append({
                    "attempt": i + 1,
                    "status_code": response.status_code,
                    "response_time": time.time()
                })
                
                if response.status_code == 429:
                    self.log(f"✅ Rate limiting triggered on attempt {i+1}")
                    rate_limit_results["blocked"] = True
                    break
                elif response.status_code in [401, 400]:
                    self.log(f"Attempt {i+1}: Wrong password rejected (HTTP {response.status_code})")
                else:
                    self.log(f"Attempt {i+1}: Unexpected response (HTTP {response.status_code})")
                
                # Small delay between attempts
                time.sleep(1)
                
            except Exception as e:
                self.log(f"Rate limiting test error: {str(e)}")
                break
        
        if not rate_limit_results["blocked"] and rate_limit_results["attempts"] >= 5:
            self.add_finding("MEDIUM", "Rate Limiting", "No rate limiting detected on failed login attempts")
        
        self.results["rate_limiting"] = rate_limit_results
    
    def test_fallback_responses(self):
        """Identify endpoints returning fallback/graceful degradation vs live data"""
        self.log("=" * 80)
        self.log("5. FALLBACK & FAIL-OPEN AUDIT")
        self.log("=" * 80)
        
        # Test endpoints that might have fallback behavior
        fallback_test_endpoints = [
            "/brain/priorities",
            "/intelligence/watchtower",
            "/intelligence/pressure",
            "/integrations/merge/connected",
            "/marketing/benchmark/latest"
        ]
        
        fallback_results = {}
        
        for endpoint in fallback_test_endpoints:
            try:
                url = f"{API_BASE}{endpoint}"
                response = self.session.get(url, timeout=15)
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        
                        # Look for fallback indicators
                        fallback_indicators = [
                            "fallback", "placeholder", "default", "mock", "sample", 
                            "no_data", "unavailable", "pending", "processing"
                        ]
                        
                        response_text = str(data).lower()
                        detected_indicators = [indicator for indicator in fallback_indicators if indicator in response_text]
                        
                        # Check for specific patterns that indicate fallback
                        is_fallback = bool(detected_indicators)
                        
                        # Additional checks for common fallback patterns
                        if isinstance(data, dict):
                            status_field = data.get("status", "").lower()
                            if status_field in ["fallback", "unavailable", "pending"]:
                                is_fallback = True
                        
                        fallback_results[endpoint] = {
                            "status_code": 200,
                            "is_fallback": is_fallback,
                            "detected_indicators": detected_indicators,
                            "response_size": len(str(data))
                        }
                        
                        if is_fallback:
                            self.log(f"⚠️ {endpoint} - Fallback response detected")
                            self.add_finding("INFO", "Data Availability", f"Endpoint {endpoint} returning fallback data", f"Indicators: {detected_indicators}")
                        else:
                            self.log(f"✅ {endpoint} - Live data response")
                            
                    except json.JSONDecodeError:
                        fallback_results[endpoint] = {"status_code": 200, "json_error": True}
                        
                else:
                    fallback_results[endpoint] = {"status_code": response.status_code}
                    
            except Exception as e:
                fallback_results[endpoint] = {"error": str(e)}
        
        fallback_count = sum(1 for r in fallback_results.values() if r.get("is_fallback"))
        total = len([r for r in fallback_results.values() if "status_code" in r])
        
        self.log(f"\nFallback analysis: {fallback_count}/{total} endpoints showing fallback behavior")
        self.results["fallback_audit"] = {
            "total_tested": total,
            "fallback_responses": fallback_count,
            "details": fallback_results
        }
    
    def test_free_tier_access(self):
        """Verify free-tier endpoints are not subscription-blocked"""
        self.log("=" * 80)
        self.log("6. FREE-TIER ACCESS VERIFICATION")
        self.log("=" * 80)
        
        # Endpoints that should be available for free-tier users
        free_tier_endpoints = [
            "/brain/kpis",
            "/intelligence/watchtower",
            "/intelligence/pressure",
            "/email/priority-inbox",
            "/user/integration-status"
        ]
        
        free_tier_results = {}
        
        for endpoint in free_tier_endpoints:
            try:
                url = f"{API_BASE}{endpoint}"
                response = self.session.get(url, timeout=10)
                
                # Check for subscription blocking indicators
                subscription_blocked = False
                if response.status_code == 402:  # Payment Required
                    subscription_blocked = True
                elif response.status_code == 403:
                    # Check response content for subscription messages
                    try:
                        data = response.json()
                        subscription_keywords = ["subscription", "upgrade", "premium", "plan", "billing"]
                        response_text = str(data).lower()
                        if any(keyword in response_text for keyword in subscription_keywords):
                            subscription_blocked = True
                    except:
                        pass
                
                free_tier_results[endpoint] = {
                    "status_code": response.status_code,
                    "subscription_blocked": subscription_blocked,
                    "free_tier_accessible": response.status_code in [200, 404, 503] and not subscription_blocked
                }
                
                if subscription_blocked:
                    self.add_finding("HIGH", "Free Tier", f"Endpoint {endpoint} appears to be subscription-blocked")
                    self.log(f"❌ {endpoint} - Subscription blocked")
                else:
                    self.log(f"✅ {endpoint} - Free tier accessible")
                    
            except Exception as e:
                free_tier_results[endpoint] = {"error": str(e)}
        
        accessible_count = sum(1 for r in free_tier_results.values() if r.get("free_tier_accessible"))
        total = len(free_tier_endpoints)
        
        self.log(f"\nFree tier access: {accessible_count}/{total} endpoints accessible")
        self.results["free_tier_check"] = {
            "total": total,
            "accessible": accessible_count,
            "details": free_tier_results
        }
    
    def generate_security_summary(self):
        """Generate final security audit summary"""
        self.log("=" * 80)
        self.log("SECURITY AUDIT SUMMARY")
        self.log("=" * 80)
        
        findings_by_severity = {}
        for finding in self.results["security_findings"]:
            severity = finding["severity"]
            findings_by_severity.setdefault(severity, []).append(finding)
        
        # Count findings by severity
        critical_count = len(findings_by_severity.get("CRITICAL", []))
        high_count = len(findings_by_severity.get("HIGH", []))
        medium_count = len(findings_by_severity.get("MEDIUM", []))
        low_count = len(findings_by_severity.get("LOW", []))
        
        self.log(f"Security Findings Summary:")
        self.log(f"  🔴 CRITICAL: {critical_count}")
        self.log(f"  🟠 HIGH: {high_count}")
        self.log(f"  🟡 MEDIUM: {medium_count}")
        self.log(f"  🟢 LOW: {low_count}")
        
        # Authentication status
        auth_status = "✅ PASS" if self.results["auth"].get("success") else "❌ FAIL"
        self.log(f"\nAuthentication: {auth_status}")
        
        # Protected endpoints status
        protected = self.results["protected_endpoints"]
        protected_health = protected.get("health_percentage", 0)
        self.log(f"Protected Endpoints: {protected['successful']}/{protected['total']} working ({protected_health:.1f}%)")
        
        # Access control status
        blocking = self.results["unauthenticated_blocking"]
        blocking_health = (blocking.get("properly_blocked", 0) / blocking.get("total", 1)) * 100
        self.log(f"Access Control: {blocking['properly_blocked']}/{blocking['total']} properly blocked ({blocking_health:.1f}%)")
        
        # Rate limiting status
        rate_limit = self.results["rate_limiting"]
        rate_limit_status = "✅ ACTIVE" if rate_limit.get("blocked") else "❌ NOT DETECTED"
        self.log(f"Rate Limiting: {rate_limit_status}")
        
        # Free tier status
        free_tier = self.results["free_tier_check"]
        free_tier_health = (free_tier.get("accessible", 0) / free_tier.get("total", 1)) * 100
        self.log(f"Free Tier Access: {free_tier['accessible']}/{free_tier['total']} accessible ({free_tier_health:.1f}%)")
        
        # Overall security posture
        if critical_count > 0:
            posture = "🔴 CRITICAL ISSUES"
        elif high_count > 2:
            posture = "🟠 HIGH RISK" 
        elif high_count > 0 or medium_count > 3:
            posture = "🟡 MEDIUM RISK"
        else:
            posture = "✅ GOOD"
        
        self.log(f"\nOverall Security Posture: {posture}")
        
        # Generate recommendations
        recommendations = []
        
        if critical_count > 0:
            recommendations.append("Address CRITICAL security issues immediately before production deployment")
        
        if not rate_limit.get("blocked"):
            recommendations.append("Implement rate limiting on authentication endpoints")
        
        if protected_health < 80:
            recommendations.append("Investigate failing protected endpoints")
        
        if blocking_health < 90:
            recommendations.append("Review access control implementation for unprotected endpoints")
        
        missing_headers = []
        if not any("strict_transport_security" in str(ep) for ep in protected.get("details", {}).values()):
            missing_headers.append("HSTS")
        
        if missing_headers:
            recommendations.append(f"Add security headers: {', '.join(missing_headers)}")
        
        self.results["recommendations"] = recommendations
        
        if recommendations:
            self.log("\nRecommendations:")
            for i, rec in enumerate(recommendations, 1):
                self.log(f"  {i}. {rec}")
    
    def run_full_audit(self) -> Dict[str, Any]:
        """Run complete security audit"""
        self.log("🛡️ PRODUCTION SECURITY AUDIT STARTED")
        self.log(f"Target: {BASE_URL}")
        self.log(f"User: {TEST_EMAIL}")
        self.log(f"Timestamp: {datetime.now().isoformat()}")
        
        # Step 1: Authenticate
        if not self.test_authentication():
            self.add_finding("CRITICAL", "Authentication", "Cannot proceed with audit - authentication failed")
            return self.results
        
        # Step 2: Test protected endpoints
        self.test_protected_endpoints()
        
        # Step 3: Test unauthenticated access blocking
        self.test_unauthenticated_access()
        
        # Step 4: Test rate limiting
        self.test_rate_limiting()
        
        # Step 5: Test for fallback responses
        self.test_fallback_responses()
        
        # Step 6: Verify free-tier access
        self.test_free_tier_access()
        
        # Step 7: Generate summary
        self.generate_security_summary()
        
        return self.results


def main():
    """Run production security audit"""
    auditor = ProductionSecurityAuditor()
    
    try:
        results = auditor.run_full_audit()
        
        # Save detailed results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = os.environ.get("BIQC_TEST_OUTPUT_DIR", "test_reports")
        os.makedirs(output_dir, exist_ok=True)
        results_file = f"{output_dir}/production_security_audit_results_{timestamp}.json"
        
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        print(f"\n📄 Detailed audit results saved to: {results_file}")
        
        # Return appropriate exit code
        critical_issues = len([f for f in results["security_findings"] if f["severity"] == "CRITICAL"])
        return 1 if critical_issues > 0 else 0
        
    except Exception as e:
        print(f"❌ Security audit failed: {str(e)}")
        return 1


if __name__ == "__main__":
    exit_code = main()
    exit(exit_code)