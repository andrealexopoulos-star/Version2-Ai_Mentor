/**
 * BIQc Pre-Launch Load Testing Script — k6
 * Simulates 100K concurrent user sessions
 * 
 * To run: k6 run k6_load_test.js --vus 1000 --duration 10m
 * For 100K: k6 run k6_load_test.js --vus 100000 --duration 30m
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const loginLatency = new Trend('login_latency_ms');
const dashboardLatency = new Trend('dashboard_latency_ms');
const aiPromptLatency = new Trend('ai_prompt_latency_ms');
const errorRate = new Rate('error_rate');
const successRate = new Rate('success_rate');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'https://beta.thestrategysquad.com';

export const options = {
  stages: [
    { duration: '2m', target: 1000 },    // Ramp up to 1K
    { duration: '5m', target: 10000 },   // Ramp to 10K
    { duration: '10m', target: 50000 },  // Ramp to 50K
    { duration: '10m', target: 100000 }, // Peak 100K
    { duration: '3m', target: 0 },       // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<800'],
    'error_rate': ['rate<0.01'],
    'login_latency_ms': ['p(95)<2000'],
    'dashboard_latency_ms': ['p(95)<3000'],
    'ai_prompt_latency_ms': ['p(95)<5000'],
  },
};

// Test data
const TEST_USERS = [
  { email: 'trent-test1@biqc-test.com', password: 'BIQcTest!2026A' },
  { email: 'trent-test3@biqc-test.com', password: 'BIQcTest!2026C' },
];

const AI_PROMPTS = [
  'What are the biggest growth opportunities?',
  'What operational risks should I focus on?',
  'How is my competitive position?',
  'What pricing changes should I consider?',
  'How can I improve customer retention?',
];

export default function () {
  const user = TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
  
  group('1. Login Flow', () => {
    const loginRes = http.post(`${BASE_URL}/api/auth/supabase/login`, JSON.stringify({
      email: user.email,
      password: user.password,
    }), { headers: { 'Content-Type': 'application/json' } });
    
    loginLatency.add(loginRes.timings.duration);
    const loginOk = check(loginRes, { 'login_200': (r) => r.status === 200 });
    errorRate.add(!loginOk);
    successRate.add(loginOk);
    
    if (loginOk) {
      const token = JSON.parse(loginRes.body).session.access_token;
      const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
      
      group('2. Dashboard Load', () => {
        const profileRes = http.get(`${BASE_URL}/api/auth/check-profile`, { headers });
        dashboardLatency.add(profileRes.timings.duration);
        check(profileRes, { 'profile_200': (r) => r.status === 200 });
      });
      
      group('3. AI Prompt', () => {
        const prompt = AI_PROMPTS[Math.floor(Math.random() * AI_PROMPTS.length)];
        const chatRes = http.post(`${BASE_URL}/api/soundboard/chat`, JSON.stringify({
          message: prompt,
          conversation_id: null,
        }), { headers, timeout: '30s' });
        
        aiPromptLatency.add(chatRes.timings.duration);
        check(chatRes, { 'ai_200': (r) => r.status === 200 });
      });
      
      group('4. Integration Sync', () => {
        const syncRes = http.get(`${BASE_URL}/api/soundboard/conversations`, { headers });
        check(syncRes, { 'sync_200': (r) => r.status === 200 });
      });
    }
  });
  
  sleep(Math.random() * 3 + 1); // 1-4 second think time
}
