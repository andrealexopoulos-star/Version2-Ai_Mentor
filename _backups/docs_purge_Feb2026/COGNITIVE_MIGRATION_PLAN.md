# Cognitive Core Migration to Supabase - Execution Plan

## Overview
Migrate 1,163-line Cognitive Core from MongoDB to Supabase PostgreSQL
Incremental, tested, peer-reviewed approach for world-class quality

---

## PHASE 1: Foundation - Core Database Operations (CRITICAL)

**Files to Modify:**
- `cognitive_core.py` - Core class and basic operations
- `server.py` - Initialization

**Functions to Migrate (Phase 1):**
1. `__init__()` - Constructor (use Supabase client)
2. `get_profile()` - Read cognitive profile
3. `_create_initial_profile()` - Create new profile
4. Basic update operations

**Testing Phase 1:**
- Create test user via OAuth
- Verify profile creation in Supabase
- Verify profile retrieval works
- Check all 4 layers initialize correctly

**Peer Review Checklist:**
- [ ] No data loss scenarios
- [ ] Error handling for Supabase failures
- [ ] JSONB fields properly formatted
- [ ] User_id isolation maintained
- [ ] No cross-user data leaks possible

---

## PHASE 2: Advisory Log System

**Functions to Migrate:**
1. `log_recommendation()` - Log AI recommendations
2. `record_recommendation_outcome()` - Track what happened
3. `get_similar_past_advice()` - Query history
4. `get_ignored_advice_for_escalation()` - Find patterns

**Testing Phase 2:**
- Create recommendation
- Verify it appears in Supabase advisory_log table
- Record outcome
- Query past advice
- Verify filtering works

**Peer Review Checklist:**
- [ ] Recommendation IDs unique
- [ ] Timestamps in correct format
- [ ] Status transitions logical
- [ ] Query performance acceptable

---

## PHASE 3: Confidence Calculation

**Functions to Migrate:**
1. `calculate_confidence()` - Multi-factor scoring
2. `_get_confidence_guidance()` - Get advice guidance

**Testing Phase 3:**
- Calculate confidence for new user (should be low)
- Add data, recalculate (should increase)
- Verify 5-factor scoring works
- Check confidence guidance output

**Peer Review Checklist:**
- [ ] Scoring math correct
- [ ] All 5 factors counted
- [ ] Edge cases handled (division by zero)
- [ ] Confidence levels accurate

---

## PHASE 4: Escalation System

**Functions to Migrate:**
1. `calculate_escalation_state()` - Evidence-based urgency
2. `escalate_ignored_advice()` - Increase urgency
3. `get_advisory_context_for_topic()` - Topic-specific context

**Testing Phase 4:**
- Create advice, mark as ignored
- Calculate escalation (should increase)
- Verify evidence tracked
- Check urgency levels

**Peer Review Checklist:**
- [ ] Escalation logic sound
- [ ] Evidence accumulation works
- [ ] Urgency levels appropriate

---

## PHASE 5: Observation System (COMPLEX)

**Functions to Migrate:**
1. `observe()` - Main learning function
2. `_observe_message()` - Learn from chat
3. `_observe_action()` - Track actions
4. `_observe_decision()` - Track decisions
5. `_observe_avoidance()` - Detect avoidance
6. `_observe_outcome()` - Learn from results
7. `_observe_sentiment()` - Detect sentiment
8. `_observe_timing()` - Track patterns
9. `_update_reality_model()` - Update facts

**Testing Phase 5:**
- Send observation (message type)
- Verify profile updates
- Check observation_count increments
- Verify behavioral patterns detected
- Test each observation type

**Peer Review Checklist:**
- [ ] All observation types work
- [ ] JSONB updates don't lose data
- [ ] Arrays append correctly
- [ ] Timestamps accurate
- [ ] No overwrite risks

---

## PHASE 6: Helper Functions

**Functions to Migrate:**
1. `get_known_information()` - What we know
2. `record_question_asked()` - Track questions
3. `get_questions_asked()` - Prevent repeats
4. `check_if_already_known()` - Avoid redundancy
5. `get_context_for_agent()` - Build AI context
6. `_calculate_profile_maturity()` - Maturity level
7. `_is_in_stress_period()` - Stress detection
8. `_calculate_action_rate()` - Action reliability

**Testing Phase 6:**
- Test each helper function
- Verify agent context generation
- Check maturity calculation
- Test stress detection

---

## PHASE 7: Integration & Initialization

**Update server.py:**
1. Change `init_cognitive_core(db)` to use Supabase
2. Update all imports
3. Test full integration

**Testing Phase 7:**
- Full end-to-end test
- OAuth user → creates profile
- Chat message → logs observation
- AI gives advice → logs recommendation
- User acts → records outcome
- Full cycle working

---

## TESTING STRATEGY

### After Each Phase:
1. **Unit Tests:** Test individual functions
2. **Integration Tests:** Test with other components
3. **Data Validation:** Verify Supabase tables populated correctly
4. **Rollback Test:** Ensure backup works if needed

### Peer Review Process:
1. I implement phase
2. I test phase
3. Troubleshoot agent reviews code
4. Troubleshoot agent tests independently
5. Both agents sign off
6. User tests
7. Move to next phase

### Success Criteria:
- ✅ No data loss
- ✅ All functions work identically
- ✅ Performance acceptable
- ✅ Error handling robust
- ✅ OAuth users fully supported
- ✅ Constitution compliance maintained

---

## ROLLBACK PLAN

If migration fails:
1. Restore `cognitive_core_mongodb_backup.py`
2. Revert server.py initialization
3. Restart backend
4. MongoDB cognitive core active again

**Backup Location:** `/app/backend/cognitive_core_mongodb_backup.py`

---

## ESTIMATED TIMELINE

**Phase 1:** 30 minutes (foundation)
**Phase 2:** 30 minutes (advisory log)
**Phase 3:** 20 minutes (confidence)
**Phase 4:** 20 minutes (escalation)
**Phase 5:** 45 minutes (observations - most complex)
**Phase 6:** 30 minutes (helpers)
**Phase 7:** 20 minutes (integration)

**Total:** ~3-4 hours with thorough testing

---

## CURRENT STATUS

✅ Backup created
✅ Migration plan documented
🔄 Phase 1 imports updated
⏸️ Awaiting approval to proceed

**Ready to execute when you approve!**
