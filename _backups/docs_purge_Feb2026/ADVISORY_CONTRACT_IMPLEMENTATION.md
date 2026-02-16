# MyAdvisor Advisory Intelligence Contract - Implementation Complete

## 🎯 Implementation Summary

**Date:** December 2024
**Priority:** P0 - Core Product Behavior
**Status:** ✅ COMPLETE - Ready for Testing

## What Was Implemented

The MyAdvisor Advisory Intelligence Contract has been fully wired into the `/api/chat` endpoint. This ensures that all proactive AI messages follow the strict four-component structure defined in the contract.

### Changes Made

#### 1. Updated `ChatRequest` Model (Line 245-252)
Added three optional metadata fields to support proactive messages:
- `trigger_source`: Why the AI is speaking (e.g., "Business Diagnosis", "Priority Inbox")
- `focus_area`: The specific area of concern (e.g., "Cash Flow", "Team Capacity")
- `confidence_level`: The AI's confidence in its assessment ("HIGH", "MEDIUM", "LIMITED")

```python
class ChatRequest(BaseModel):
    message: str
    context_type: Optional[str] = "general"
    session_id: Optional[str] = None
    # Metadata for proactive messages (Advisory Intelligence Contract)
    trigger_source: Optional[str] = None
    focus_area: Optional[str] = None
    confidence_level: Optional[str] = None
```

#### 2. Updated `get_ai_response` Function (Line 2166)
Added `metadata` parameter to the function signature:
```python
async def get_ai_response(..., metadata: dict = None) -> str:
```

#### 3. Wired `get_system_prompt` Call (Line 2217)
Updated the call to pass metadata to the system prompt generator:
```python
system_prompt = get_system_prompt(context_type, user_data, business_knowledge, metadata)
```

#### 4. Updated `/api/chat` Endpoint (Line 4388-4425)
Added logic to extract metadata from the request when `context_type == "proactive"`:
```python
# Build metadata for proactive messages (Advisory Intelligence Contract)
metadata = None
if request.context_type == "proactive":
    metadata = {
        "trigger_source": request.trigger_source,
        "focus_area": request.focus_area,
        "confidence_level": request.confidence_level
    }

response = await get_ai_response(
    enhanced_message,
    request.context_type or "general",
    session_id,
    user_id=user_id,
    user_data={"name": current_user.get("name"), "business_name": profile.get("business_name")},
    use_advanced=False,
    metadata=metadata
)
```

## How It Works

### Regular Messages (context_type: "general")
For normal chat interactions, the endpoint behaves as before:
- `metadata` remains `None`
- The AI uses the standard "MyAdvisor" system prompt
- No proactive contract enforcement

### Proactive Messages (context_type: "proactive")
When a proactive trigger fires:
1. The calling code sets `context_type = "proactive"`
2. The calling code provides `trigger_source`, `focus_area`, and `confidence_level`
3. The `/api/chat` endpoint packages these into a `metadata` dict
4. `get_system_prompt` receives the metadata and generates the **proactive system prompt**
5. The AI response MUST follow the four-component structure:
   - **Context Anchor** (Why I am speaking)
   - **Diagnostic Observation** (What is happening)
   - **Implication Framing** (Why this matters)
   - **Advisory Pathways** (What happens next)

## Contract Enforcement Rules

The `get_system_prompt` function (starting at line 1301) enforces these rules:
- ✅ First sentence must NOT be a question
- ✅ Maximum 4 sentences (excluding pathway options)
- ✅ NO polite filler, motivational language, or emojis
- ✅ Must have a valid trigger source (if missing, AI outputs NOTHING)
- ✅ Confidence level dictates tone and language strength
- ✅ Pathways are OPTIONS, not commands

## Testing Guide

### Test Case 1: Regular Chat Message
**Endpoint:** `POST /api/chat`
**Request:**
```json
{
  "message": "What should I focus on this week?",
  "context_type": "general",
  "session_id": "test-session-001"
}
```
**Expected Behavior:**
- Uses standard MyAdvisor system prompt
- Response follows the standard three-part structure (Situation → Decision → Next step)
- No proactive contract enforcement

### Test Case 2: Proactive Message (High Confidence)
**Endpoint:** `POST /api/chat`
**Request:**
```json
{
  "message": "System-generated proactive insight",
  "context_type": "proactive",
  "trigger_source": "Business Diagnosis",
  "focus_area": "Cash Flow",
  "confidence_level": "HIGH",
  "session_id": "test-session-002"
}
```
**Expected Behavior:**
- Uses proactive advisory system prompt
- Response follows four-component structure
- Tone is direct and assertive (HIGH confidence)
- Includes explicit trigger reference in context anchor

### Test Case 3: Proactive Message (Limited Confidence)
**Endpoint:** `POST /api/chat`
**Request:**
```json
{
  "message": "System-generated proactive insight",
  "context_type": "proactive",
  "trigger_source": "Priority Inbox",
  "focus_area": "Team Capacity",
  "confidence_level": "LIMITED",
  "session_id": "test-session-003"
}
```
**Expected Behavior:**
- Uses proactive advisory system prompt
- Tone is exploratory and tentative (LIMITED confidence)
- Pathways prioritize clarification over action
- Uses hedging language ("I'd need to understand...")

### Test Case 4: Proactive Message Without Metadata (Fail-Safe)
**Endpoint:** `POST /api/chat`
**Request:**
```json
{
  "message": "System-generated proactive insight",
  "context_type": "proactive",
  "session_id": "test-session-004"
}
```
**Expected Behavior:**
- Metadata is `None` or incomplete
- The proactive system prompt receives missing metadata
- Per contract rules (line 1409-1415), AI should output NOTHING or minimal response
- Demonstrates the fail-safe behavior (silence is better than unjustified speech)

## Integration Points

### Where to Call This
Any system component that wants to trigger a proactive advisory message should:
1. Determine the `trigger_source` (e.g., "Business Diagnosis", "Email Analysis")
2. Identify the `focus_area` (e.g., "Cash Flow", "Decision Velocity")
3. Calculate a `confidence_level` ("HIGH", "MEDIUM", or "LIMITED")
4. Call `/api/chat` with `context_type="proactive"` and all three metadata fields

### Current Potential Triggers
Based on the codebase, these features could trigger proactive messages:
- **Business Diagnosis Page**: When a new assessment is generated
- **Priority Inbox**: When critical email patterns are detected
- **MyIntel**: When intelligence signals are detected

## Verification Checklist

- [x] `ChatRequest` model updated with metadata fields
- [x] `get_ai_response` function signature includes `metadata` parameter
- [x] `get_system_prompt` call passes `metadata` parameter
- [x] `/api/chat` endpoint extracts and packages metadata
- [x] Backend imports successfully (no syntax errors)
- [x] Backend server running without errors
- [ ] Backend test with curl (requires authentication)
- [ ] Integration test with actual proactive trigger
- [ ] User verification of proactive message quality

## Next Steps

1. **Backend Testing** (YOU ARE HERE)
   - Test regular chat messages via curl
   - Test proactive messages with metadata via curl
   - Verify system prompt is correctly generated for both types

2. **Integration Testing**
   - Wire the Business Diagnosis page to trigger proactive messages
   - Wire the Priority Inbox to trigger proactive messages
   - Test end-to-end proactive flow

3. **User Validation**
   - Review AI responses for contract compliance
   - Verify tone, structure, and confidence alignment
   - Adjust prompts if needed

## Architecture Notes

- The `get_system_prompt` function is the single source of truth for all AI behavior
- The proactive contract is defined starting at line 1301
- The contract is completely isolated from the general/mentor/intel contexts
- All existing endpoints continue to work unchanged (backward compatible)

## Success Criteria

✅ This implementation is successful when:
1. Regular chat messages work exactly as before
2. Proactive messages with metadata trigger the proactive system prompt
3. The AI response follows the four-component structure
4. Confidence level correctly affects tone and language
5. Missing metadata triggers fail-safe behavior (silence or minimal response)

---

**Implementation Status:** COMPLETE
**Testing Status:** PENDING
**User Verification:** PENDING
