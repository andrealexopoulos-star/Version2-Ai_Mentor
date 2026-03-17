#!/bin/bash
# BIQC - MyAdvisor Advisory Intelligence Contract
# Integration Test Script with curl
# Requires: Valid user authentication

# Configuration
API_URL="https://data-pipeline-test-7.preview.emergentagent.com/api"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================================"
echo "BIQC - MyAdvisor Advisory Intelligence Contract"
echo "Integration Tests (requires authentication)"
echo "============================================================"

# Check if auth token is provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ ERROR: Authentication token required${NC}"
    echo ""
    echo "Usage: $0 <AUTH_TOKEN>"
    echo ""
    echo "To get your token:"
    echo "1. Log in to BIQC via the web interface"
    echo "2. Open browser DevTools (F12)"
    echo "3. Go to Application > Local Storage"
    echo "4. Find the 'supabase.auth.token' key"
    echo "5. Copy the access_token value"
    echo ""
    echo "Then run: $0 'your-token-here'"
    exit 1
fi

AUTH_TOKEN="$1"

echo -e "\n${YELLOW}🔑 Using authentication token: ${AUTH_TOKEN:0:20}...${NC}"

# Test 1: Regular Chat Message
echo -e "\n============================================================"
echo "TEST 1: Regular Chat Message (context_type: general)"
echo "============================================================"

RESPONSE=$(curl -s -X POST "$API_URL/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "message": "What should I focus on this week?",
    "context_type": "general"
  }')

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

# Check if response contains expected structure
if echo "$RESPONSE" | grep -q "response"; then
    echo -e "\n${GREEN}✅ Regular chat message works${NC}"
else
    echo -e "\n${RED}❌ Regular chat message failed${NC}"
fi

# Test 2: Proactive Message with HIGH Confidence
echo -e "\n============================================================"
echo "TEST 2: Proactive Message (HIGH Confidence)"
echo "============================================================"
echo "Trigger: Business Diagnosis → Cash Flow (HIGH confidence)"

RESPONSE=$(curl -s -X POST "$API_URL/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "message": "I need to understand your cash flow patterns based on recent diagnosis.",
    "context_type": "proactive",
    "trigger_source": "Business Diagnosis",
    "focus_area": "Cash Flow",
    "confidence_level": "HIGH"
  }')

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

# Check for proactive contract elements
RESPONSE_TEXT=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('response', ''))" 2>/dev/null)

echo -e "\n${YELLOW}Checking proactive contract compliance...${NC}"
echo "Expected: Context Anchor → Diagnostic Observation → Implication → Advisory Pathways"

# Basic validation (just checking response exists)
if [ ! -z "$RESPONSE_TEXT" ]; then
    echo -e "${GREEN}✅ Proactive message generated${NC}"
    echo -e "\n${YELLOW}AI Response:${NC}"
    echo "$RESPONSE_TEXT"
else
    echo -e "${RED}❌ Proactive message failed${NC}"
fi

# Test 3: Proactive Message with LIMITED Confidence
echo -e "\n============================================================"
echo "TEST 3: Proactive Message (LIMITED Confidence)"
echo "============================================================"
echo "Trigger: Priority Inbox → Team Capacity (LIMITED confidence)"

RESPONSE=$(curl -s -X POST "$API_URL/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "message": "I have limited visibility into your team capacity patterns.",
    "context_type": "proactive",
    "trigger_source": "Priority Inbox",
    "focus_area": "Team Capacity",
    "confidence_level": "LIMITED"
  }')

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

RESPONSE_TEXT=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('response', ''))" 2>/dev/null)

echo -e "\n${YELLOW}Checking confidence adaptation...${NC}"
echo "Expected: Tentative tone, clarifying questions, hedging language"

if [ ! -z "$RESPONSE_TEXT" ]; then
    echo -e "${GREEN}✅ Proactive message with LIMITED confidence generated${NC}"
    echo -e "\n${YELLOW}AI Response:${NC}"
    echo "$RESPONSE_TEXT"
else
    echo -e "${RED}❌ Proactive message failed${NC}"
fi

# Test 4: Proactive Message WITHOUT Metadata (Fail-Safe)
echo -e "\n============================================================"
echo "TEST 4: Proactive Message WITHOUT Metadata (Fail-Safe Test)"
echo "============================================================"
echo "This should trigger fail-safe behavior (minimal/no response)"

RESPONSE=$(curl -s -X POST "$API_URL/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "message": "This is a proactive message without metadata.",
    "context_type": "proactive"
  }')

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

RESPONSE_TEXT=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('response', ''))" 2>/dev/null)

echo -e "\n${YELLOW}Checking fail-safe behavior...${NC}"
echo "Expected: Minimal response or request for more context (metadata shows 'Unknown')"

if [ ! -z "$RESPONSE_TEXT" ]; then
    echo -e "${GREEN}✅ Fail-safe test completed${NC}"
    echo -e "\n${YELLOW}AI Response:${NC}"
    echo "$RESPONSE_TEXT"
    echo -e "\n${YELLOW}Note: AI should indicate limited context or ask for clarification${NC}"
else
    echo -e "${RED}❌ Fail-safe test failed${NC}"
fi

echo -e "\n============================================================"
echo "TEST SUMMARY"
echo "============================================================"
echo "✅ If all tests returned valid JSON responses, the implementation works"
echo "✅ Review AI responses above to verify contract compliance:"
echo "   - Regular messages follow standard 3-part structure"
echo "   - Proactive messages follow 4-part contract structure"
echo "   - HIGH confidence uses assertive, direct tone"
echo "   - LIMITED confidence uses tentative, questioning tone"
echo "   - Missing metadata triggers fail-safe behavior"
echo ""
echo "============================================================"
