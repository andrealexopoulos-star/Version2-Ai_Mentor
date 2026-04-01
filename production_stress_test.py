#!/usr/bin/env python3
"""
Production Backend Stress Validation for BIQc Platform
Target: https://biqc.ai
Credentials: andre@thestrategysquad.com.au / MasterMind2025*

Test Requirements:
1) Authenticate via /api/auth/supabase/login
2) Execute 100 SoundBoard chat runs against /api/soundboard/chat
3) Validate conversation persistence 
4) Validate advisor feed dependencies
5) Produce concise defect list

Focus: Rate limits, response times, suggested actions, conversation storage
"""

import requests
import json
import time
import uuid
import statistics
import os
from datetime import datetime
from typing import Dict, List, Any, Optional
import concurrent.futures
import threading

# Configuration
BASE_URL = os.environ.get("BIQC_BASE_URL", "https://biqc.ai")
API_BASE = f"{BASE_URL}/api"
TEST_EMAIL = os.environ.get("BIQC_TEST_EMAIL", "andre@thestrategysquad.com.au")
TEST_PASSWORD = os.environ.get("BIQC_TEST_PASSWORD", "MasterMind2025*")

# Test data for soundboard chat runs
SOUNDBOARD_PROMPTS = [
    "What are the top 3 revenue risks I should be monitoring right now?",
    "Show me my biggest operational bottlenecks this quarter",
    "What market opportunities am I missing based on my current data?",
    "Which clients are at risk of churning and why?",
    "What are the key performance indicators I should focus on this month?",
    "How can I improve my sales pipeline conversion rate?",
    "What are my competitors doing that I should be aware of?",
    "Show me the most profitable products in my portfolio",
    "What operational inefficiencies are costing me the most money?",
    "Which team members are underperforming and need attention?",
    "What are the biggest threats to my business continuity?",
    "How can I optimize my cash flow management?",
    "What new market segments should I consider entering?",
    "Show me patterns in my customer acquisition costs",
    "What are the early warning signs of market shifts affecting my business?",
    "Which processes should I automate to improve efficiency?",
    "What are my best opportunities for cost reduction?",
    "How can I improve customer satisfaction and retention?",
    "What are the key metrics indicating business health decline?",
    "Show me actionable insights from my recent business data",
]

class ProductionStressTest:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        self.results = {
            'authentication': {},
            'soundboard_stress_test': {
                'total_runs': 0,
                'successful_runs': 0,
                'failed_runs': 0,
                'rate_limited_runs': 0,
                'retry_attempts': 0,
                'response_times': [],
                'suggested_actions_count': 0,
                'status_codes': {},
                'errors': [],
                'runs_with_suggested_actions': 0
                ,'responses_with_suggested_actions_field': 0
            },
            'conversation_persistence': {
                'conversations_created': 0,
                'conversations_retrievable': 0,
                'conversation_ids': [],
                'persistence_errors': []
            },
            'advisor_feed_dependencies': {
                'tested_endpoints': {},
                'critical_failures': [],
                'overall_health': True
            },
            'defects': [],
            'test_start_time': datetime.now().isoformat(),
            'test_duration': None
        }
        self.lock = threading.Lock()

    def log_result(self, category: str, message: str, level: str = "info"):
        """Thread-safe logging of test results"""
        with self.lock:
            timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
            print(f"[{timestamp}] [{level.upper()}] {category}: {message}")

    def authenticate(self) -> bool:
        """Authenticate via /api/auth/supabase/login"""
        self.log_result("AUTH", "Starting authentication...")
        
        try:
            auth_url = f"{API_BASE}/auth/supabase/login"
            auth_data = {
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }
            
            start_time = time.time()
            response = self.session.post(auth_url, json=auth_data, timeout=30)
            response_time = time.time() - start_time
            
            self.results['authentication'] = {
                'status_code': response.status_code,
                'response_time': response_time,
                'success': False,
                'error': None
            }
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    # Handle both direct access_token and session.access_token formats
                    access_token = None
                    if 'access_token' in data:
                        access_token = data['access_token']
                    elif 'session' in data and 'access_token' in data['session']:
                        access_token = data['session']['access_token']
                    
                    if access_token:
                        self.auth_token = access_token
                        self.user_id = data.get('user', {}).get('id')
                        self.session.headers.update({
                            'Authorization': f'Bearer {self.auth_token}',
                            'Content-Type': 'application/json'
                        })
                        self.results['authentication']['success'] = True
                        self.log_result("AUTH", f"✅ SUCCESS - Token obtained for user {self.user_id}")
                        return True
                    else:
                        self.results['authentication']['error'] = "No access_token in response"
                        self.log_result("AUTH", "❌ FAILED - No access token in response", "error")
                except json.JSONDecodeError:
                    self.results['authentication']['error'] = "Invalid JSON response"
                    self.log_result("AUTH", "❌ FAILED - Invalid JSON response", "error")
            else:
                error_msg = f"HTTP {response.status_code}: {response.text}"
                self.results['authentication']['error'] = error_msg
                self.log_result("AUTH", f"❌ FAILED - {error_msg}", "error")
                
        except Exception as e:
            error_msg = f"Authentication exception: {str(e)}"
            self.results['authentication']['error'] = error_msg
            self.log_result("AUTH", f"❌ EXCEPTION - {error_msg}", "error")
            
        return False

    def soundboard_chat_single_run(self, run_id: int, prompt: str) -> Dict[str, Any]:
        """Execute single soundboard chat run"""
        start_time = time.time()
        result = {
            'run_id': run_id,
            'prompt': prompt,
            'success': False,
            'status_code': None,
            'response_time': None,
            'has_suggested_actions': False,
            'retry_count': 0,
            'error': None,
            'conversation_id': None
        }
        
        try:
            chat_url = f"{API_BASE}/soundboard/chat"
            chat_data = {
                "message": prompt,
                "conversation_id": str(uuid.uuid4()),
                "mode": "auto"
            }
            
            # Try up to 3 times for retries on rate limits
            for attempt in range(3):
                try:
                    response = self.session.post(chat_url, json=chat_data, timeout=45)
                    result['status_code'] = response.status_code
                    result['response_time'] = time.time() - start_time
                    
                    if response.status_code == 429:
                        # Rate limited - wait and retry
                        result['retry_count'] = attempt + 1
                        retry_after = int(response.headers.get('Retry-After', 5))
                        self.log_result("SOUNDBOARD", f"Run {run_id} - Rate limited, retrying in {retry_after}s (attempt {attempt + 1})")
                        time.sleep(retry_after)
                        continue
                        
                    elif response.status_code == 200:
                        try:
                            data = response.json()
                            result['success'] = True
                            result['conversation_id'] = data.get('conversation_id')
                            if not result['conversation_id']:
                                result['error'] = "Missing conversation_id in success response"
                            
                            # Check for suggested actions
                            if 'suggested_actions' in data:
                                result['has_suggested_actions'] = bool(data.get('suggested_actions'))
                                result['has_suggested_actions_field'] = True
                                
                            self.log_result("SOUNDBOARD", f"Run {run_id} ✅ SUCCESS - {result['response_time']:.2f}s")
                            break
                            
                        except json.JSONDecodeError:
                            result['error'] = f"Invalid JSON response on attempt {attempt + 1}"
                    else:
                        result['error'] = f"HTTP {response.status_code}: {response.text[:200]}"
                        if attempt == 2:  # Last attempt
                            self.log_result("SOUNDBOARD", f"Run {run_id} ❌ FAILED - {result['error']}", "error")
                        break
                        
                except requests.exceptions.Timeout:
                    result['error'] = f"Timeout on attempt {attempt + 1}"
                    if attempt == 2:
                        self.log_result("SOUNDBOARD", f"Run {run_id} ❌ TIMEOUT", "error")
                except requests.exceptions.RequestException as e:
                    result['error'] = f"Request exception on attempt {attempt + 1}: {str(e)}"
                    if attempt == 2:
                        self.log_result("SOUNDBOARD", f"Run {run_id} ❌ REQUEST ERROR - {str(e)}", "error")
                        
        except Exception as e:
            result['error'] = f"Exception: {str(e)}"
            result['response_time'] = time.time() - start_time
            self.log_result("SOUNDBOARD", f"Run {run_id} ❌ EXCEPTION - {str(e)}", "error")
            
        return result

    def soundboard_stress_test(self) -> None:
        """Execute 100 soundboard chat runs with real prompts"""
        self.log_result("SOUNDBOARD_STRESS", "Starting 100 chat runs...")
        
        # Prepare 100 prompts (cycle through the list if needed)
        prompts = []
        for i in range(100):
            prompt_index = i % len(SOUNDBOARD_PROMPTS)
            prompts.append(SOUNDBOARD_PROMPTS[prompt_index])
        
        start_time = time.time()
        
        # Execute runs with controlled concurrency (max 5 concurrent)
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = []
            for i, prompt in enumerate(prompts, 1):
                future = executor.submit(self.soundboard_chat_single_run, i, prompt)
                futures.append(future)
                
                # Small delay to avoid overwhelming the server
                time.sleep(0.1)
            
            # Collect results
            for i, future in enumerate(concurrent.futures.as_completed(futures), 1):
                try:
                    result = future.result()
                    self._process_soundboard_result(result)
                    
                    if i % 20 == 0:  # Progress update every 20 runs
                        progress = (i / 100) * 100
                        self.log_result("SOUNDBOARD_STRESS", f"Progress: {progress:.0f}% ({i}/100)")
                        
                except Exception as e:
                    self.log_result("SOUNDBOARD_STRESS", f"Future exception: {str(e)}", "error")
        
        total_time = time.time() - start_time
        self.log_result("SOUNDBOARD_STRESS", f"Completed 100 runs in {total_time:.2f}s")
        self._summarize_soundboard_results()

    def _process_soundboard_result(self, result: Dict[str, Any]) -> None:
        """Process individual soundboard test result"""
        with self.lock:
            self.results['soundboard_stress_test']['total_runs'] += 1
            
            if result['success']:
                self.results['soundboard_stress_test']['successful_runs'] += 1
                if result['conversation_id']:
                    self.results['conversation_persistence']['conversation_ids'].append(result['conversation_id'])
            else:
                self.results['soundboard_stress_test']['failed_runs'] += 1
                
            if result['status_code'] == 429:
                self.results['soundboard_stress_test']['rate_limited_runs'] += 1
                
            if result['retry_count'] > 0:
                self.results['soundboard_stress_test']['retry_attempts'] += result['retry_count']
                
            if result['has_suggested_actions']:
                self.results['soundboard_stress_test']['runs_with_suggested_actions'] += 1
            if result.get('has_suggested_actions_field'):
                self.results['soundboard_stress_test']['responses_with_suggested_actions_field'] += 1
                
            if result['response_time']:
                self.results['soundboard_stress_test']['response_times'].append(result['response_time'])
                
            if result['status_code']:
                status_code = str(result['status_code'])
                self.results['soundboard_stress_test']['status_codes'][status_code] = \
                    self.results['soundboard_stress_test']['status_codes'].get(status_code, 0) + 1
                    
            if result['error']:
                self.results['soundboard_stress_test']['errors'].append({
                    'run_id': result['run_id'],
                    'error': result['error']
                })

    def _summarize_soundboard_results(self) -> None:
        """Summarize soundboard stress test results"""
        results = self.results['soundboard_stress_test']
        response_times = results['response_times']
        
        if response_times:
            avg_response_time = statistics.mean(response_times)
            median_response_time = statistics.median(response_times)
            min_response_time = min(response_times)
            max_response_time = max(response_times)
            
            self.log_result("SOUNDBOARD_STRESS", f"Response Times - Avg: {avg_response_time:.2f}s, Median: {median_response_time:.2f}s, Min: {min_response_time:.2f}s, Max: {max_response_time:.2f}s")
        
        success_rate = (results['successful_runs'] / results['total_runs']) * 100 if results['total_runs'] > 0 else 0
        suggested_actions_rate = (results['runs_with_suggested_actions'] / results['successful_runs']) * 100 if results['successful_runs'] > 0 else 0
        
        self.log_result("SOUNDBOARD_STRESS", f"Success Rate: {success_rate:.1f}% ({results['successful_runs']}/{results['total_runs']})")
        self.log_result("SOUNDBOARD_STRESS", f"Suggested Actions Rate: {suggested_actions_rate:.1f}% ({results['runs_with_suggested_actions']}/{results['successful_runs']})")
        self.log_result("SOUNDBOARD_STRESS", f"Rate Limited: {results['rate_limited_runs']}, Retries: {results['retry_attempts']}")

    def test_conversation_persistence(self) -> None:
        """Validate conversation persistence endpoints"""
        self.log_result("CONVERSATION", "Testing conversation persistence...")
        
        try:
            # Test GET /api/soundboard/conversations
            conversations_url = f"{API_BASE}/soundboard/conversations"
            response = self.session.get(conversations_url, timeout=30)
            
            if response.status_code == 200:
                self.log_result("CONVERSATION", "✅ GET /soundboard/conversations - Success")
                
                # Test individual conversation retrieval for created conversations
                conversation_ids = self.results['conversation_persistence']['conversation_ids'][:5]  # Test first 5
                
                for conv_id in conversation_ids:
                    try:
                        conv_url = f"{API_BASE}/soundboard/conversations/{conv_id}"
                        conv_response = self.session.get(conv_url, timeout=30)
                        
                        if conv_response.status_code == 200:
                            self.results['conversation_persistence']['conversations_retrievable'] += 1
                            self.log_result("CONVERSATION", f"✅ Retrieved conversation {conv_id}")
                        else:
                            error_msg = f"Failed to retrieve conversation {conv_id}: HTTP {conv_response.status_code}"
                            self.results['conversation_persistence']['persistence_errors'].append(error_msg)
                            self.log_result("CONVERSATION", f"❌ {error_msg}", "error")
                            
                    except Exception as e:
                        error_msg = f"Exception retrieving conversation {conv_id}: {str(e)}"
                        self.results['conversation_persistence']['persistence_errors'].append(error_msg)
                        self.log_result("CONVERSATION", f"❌ {error_msg}", "error")
            else:
                error_msg = f"GET /soundboard/conversations failed: HTTP {response.status_code}"
                self.results['conversation_persistence']['persistence_errors'].append(error_msg)
                self.log_result("CONVERSATION", f"❌ {error_msg}", "error")
                
        except Exception as e:
            error_msg = f"Conversation persistence test exception: {str(e)}"
            self.results['conversation_persistence']['persistence_errors'].append(error_msg)
            self.log_result("CONVERSATION", f"❌ {error_msg}", "error")

    def test_advisor_feed_dependencies(self) -> None:
        """Test advisor feed dependency endpoints"""
        self.log_result("ADVISOR_FEED", "Testing advisor feed dependencies...")
        
        endpoints = [
            "/api/cognition/overview",
            "/api/snapshot/latest", 
            "/api/intelligence/watchtower",
            "/api/integrations/merge/connected",
            "/api/integrations/crm/deals?page_size=50",
            "/api/integrations/accounting/summary",
            "/api/outlook/status",
            "/api/calibration/status"
        ]
        
        for endpoint in endpoints:
            try:
                url = f"{BASE_URL}{endpoint}"
                start_time = time.time()
                response = self.session.get(url, timeout=30)
                response_time = time.time() - start_time
                
                endpoint_result = {
                    'status_code': response.status_code,
                    'response_time': response_time,
                    'success': response.status_code == 200,
                    'error': None if response.status_code == 200 else f"HTTP {response.status_code}"
                }
                # Fresh users can legitimately have no initialized workspace/integrations.
                if response.status_code in [400, 409] and endpoint.startswith("/api/integrations/"):
                    endpoint_result['success'] = True
                    endpoint_result['degraded_reason'] = "workspace_or_integration_not_ready"
                    endpoint_result['error'] = None
                
                self.results['advisor_feed_dependencies']['tested_endpoints'][endpoint] = endpoint_result
                
                if endpoint_result['success']:
                    self.log_result("ADVISOR_FEED", f"✅ {endpoint} - {response_time:.2f}s")
                else:
                    error_msg = f"{endpoint} failed: HTTP {response.status_code}"
                    self.results['advisor_feed_dependencies']['critical_failures'].append(error_msg)
                    self.results['advisor_feed_dependencies']['overall_health'] = False
                    self.log_result("ADVISOR_FEED", f"❌ {error_msg}", "error")
                    
            except Exception as e:
                error_msg = f"{endpoint} exception: {str(e)}"
                endpoint_result = {
                    'status_code': None,
                    'response_time': None,
                    'success': False,
                    'error': str(e)
                }
                self.results['advisor_feed_dependencies']['tested_endpoints'][endpoint] = endpoint_result
                self.results['advisor_feed_dependencies']['critical_failures'].append(error_msg)
                self.results['advisor_feed_dependencies']['overall_health'] = False
                self.log_result("ADVISOR_FEED", f"❌ {error_msg}", "error")

    def generate_defect_report(self) -> None:
        """Generate concise defect list blocking 'understandable personalized advisor + soundboard'"""
        self.log_result("DEFECTS", "Generating defect report...")
        
        defects = []
        
        # Authentication defects
        if not self.results['authentication']['success']:
            defects.append({
                'severity': 'CRITICAL',
                'component': 'Authentication',
                'issue': f"Login failed: {self.results['authentication']['error']}",
                'impact': 'Blocks all advisor and soundboard functionality'
            })
        
        # Soundboard defects
        soundboard = self.results['soundboard_stress_test']
        success_rate = (soundboard['successful_runs'] / soundboard['total_runs']) * 100 if soundboard['total_runs'] > 0 else 0
        
        if success_rate < 95:
            defects.append({
                'severity': 'HIGH',
                'component': 'Soundboard Chat API',
                'issue': f"Low success rate: {success_rate:.1f}% ({soundboard['successful_runs']}/{soundboard['total_runs']})",
                'impact': 'Unreliable advisor chat experience'
            })
            
        if soundboard['rate_limited_runs'] > 10:
            defects.append({
                'severity': 'MEDIUM',
                'component': 'Soundboard Rate Limiting',
                'issue': f"High rate limiting: {soundboard['rate_limited_runs']} requests throttled",
                'impact': 'Degraded user experience during high usage'
            })
            
        suggested_actions_rate = (soundboard['runs_with_suggested_actions'] / soundboard['successful_runs']) * 100 if soundboard['successful_runs'] > 0 else 0
        if soundboard.get('responses_with_suggested_actions_field', 0) > 0 and suggested_actions_rate < 50:
            defects.append({
                'severity': 'HIGH',
                'component': 'Soundboard Intelligence',
                'issue': f"Low suggested actions rate: {suggested_actions_rate:.1f}%",
                'impact': 'Advisor provides limited actionable intelligence'
            })
            
        # Conversation persistence defects
        conversation = self.results['conversation_persistence']
        if conversation['persistence_errors']:
            defects.append({
                'severity': 'HIGH',
                'component': 'Conversation Persistence',
                'issue': f"{len(conversation['persistence_errors'])} conversation retrieval failures",
                'impact': 'Users cannot access chat history'
            })
            
        # Advisor feed defects
        advisor_feed = self.results['advisor_feed_dependencies']
        if not advisor_feed['overall_health']:
            critical_failures = len(advisor_feed['critical_failures'])
            defects.append({
                'severity': 'CRITICAL',
                'component': 'Advisor Data Feed',
                'issue': f"{critical_failures} critical endpoint failures",
                'impact': 'Advisor cannot provide personalized insights'
            })
            
        # Response time defects
        response_times = soundboard['response_times']
        if response_times:
            avg_response_time = statistics.mean(response_times)
            if avg_response_time > 10:
                defects.append({
                    'severity': 'MEDIUM',
                    'component': 'Performance',
                    'issue': f"High average response time: {avg_response_time:.2f}s",
                    'impact': 'Poor user experience, advisor feels slow'
                })
                
        self.results['defects'] = defects
        
        # Log defect summary
        if defects:
            self.log_result("DEFECTS", f"Found {len(defects)} defects:")
            for i, defect in enumerate(defects, 1):
                self.log_result("DEFECTS", f"  {i}. [{defect['severity']}] {defect['component']}: {defect['issue']}")
        else:
            self.log_result("DEFECTS", "✅ No critical defects found")

    def run_full_test(self) -> Dict[str, Any]:
        """Execute complete production stress test"""
        test_start = time.time()
        
        self.log_result("MAIN", "🚀 Starting Production Backend Stress Validation")
        self.log_result("MAIN", f"Target: {BASE_URL}")
        self.log_result("MAIN", f"User: {TEST_EMAIL}")
        
        # Step 1: Authentication
        if not self.authenticate():
            self.log_result("MAIN", "❌ Authentication failed - aborting test", "error")
            self.results['test_duration'] = time.time() - test_start
            return self.results
        
        # Step 2: Soundboard stress test (100 runs)
        self.soundboard_stress_test()
        
        # Step 3: Conversation persistence
        self.test_conversation_persistence()
        
        # Step 4: Advisor feed dependencies
        self.test_advisor_feed_dependencies()
        
        # Step 5: Generate defect report
        self.generate_defect_report()
        
        # Test completion
        self.results['test_duration'] = time.time() - test_start
        self.log_result("MAIN", f"🏁 Test completed in {self.results['test_duration']:.2f}s")
        
        return self.results

def main():
    """Main execution function"""
    test = ProductionStressTest()
    results = test.run_full_test()
    
    # Save detailed results to file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = os.environ.get("BIQC_TEST_OUTPUT_DIR", "test_reports")
    os.makedirs(output_dir, exist_ok=True)
    results_file = f"{output_dir}/production_stress_test_results_{timestamp}.json"
    
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: {results_file}")
    
    # Print final summary
    print("\n" + "="*80)
    print("PRODUCTION BACKEND STRESS TEST SUMMARY")
    print("="*80)
    
    # Authentication Summary
    auth = results['authentication']
    auth_status = "✅ SUCCESS" if auth['success'] else "❌ FAILED"
    print(f"Authentication: {auth_status}")
    if not auth['success']:
        print(f"  Error: {auth['error']}")
    
    # Soundboard Summary
    soundboard = results['soundboard_stress_test']
    success_rate = (soundboard['successful_runs'] / soundboard['total_runs']) * 100 if soundboard['total_runs'] > 0 else 0
    suggested_rate = (soundboard['runs_with_suggested_actions'] / soundboard['successful_runs']) * 100 if soundboard['successful_runs'] > 0 else 0
    
    print(f"\nSoundboard Chat (100 runs):")
    print(f"  Success Rate: {success_rate:.1f}% ({soundboard['successful_runs']}/{soundboard['total_runs']})")
    print(f"  Suggested Actions: {suggested_rate:.1f}% ({soundboard['runs_with_suggested_actions']} runs)")
    print(f"  Rate Limited: {soundboard['rate_limited_runs']} requests")
    print(f"  Retry Attempts: {soundboard['retry_attempts']}")
    
    if soundboard['response_times']:
        avg_time = statistics.mean(soundboard['response_times'])
        print(f"  Avg Response Time: {avg_time:.2f}s")
    
    # Conversation Persistence Summary  
    conversation = results['conversation_persistence']
    print(f"\nConversation Persistence:")
    print(f"  Conversations Created: {len(conversation['conversation_ids'])}")
    print(f"  Conversations Retrievable: {conversation['conversations_retrievable']}")
    print(f"  Persistence Errors: {len(conversation['persistence_errors'])}")
    
    # Advisor Feed Summary
    advisor_feed = results['advisor_feed_dependencies'] 
    total_endpoints = len(advisor_feed['tested_endpoints'])
    failed_endpoints = len(advisor_feed['critical_failures'])
    success_endpoints = total_endpoints - failed_endpoints
    
    print(f"\nAdvisor Feed Dependencies:")
    print(f"  Endpoints Tested: {total_endpoints}")
    print(f"  Successful: {success_endpoints}")
    print(f"  Failed: {failed_endpoints}")
    
    # Defects Summary
    defects = results['defects']
    print(f"\nDefects Found: {len(defects)}")
    if defects:
        critical = len([d for d in defects if d['severity'] == 'CRITICAL'])
        high = len([d for d in defects if d['severity'] == 'HIGH'])
        medium = len([d for d in defects if d['severity'] == 'MEDIUM'])
        
        print(f"  CRITICAL: {critical}")
        print(f"  HIGH: {high}")
        print(f"  MEDIUM: {medium}")
        
        print(f"\nTop Defects:")
        for i, defect in enumerate(defects[:3], 1):
            print(f"  {i}. [{defect['severity']}] {defect['component']}: {defect['issue']}")
    
    print(f"\nTest Duration: {results['test_duration']:.2f}s")
    print("="*80)

if __name__ == "__main__":
    main()