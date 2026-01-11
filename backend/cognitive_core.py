"""
Per-User Cognitive Core
========================
Maintains a continuously evolving, non-resetting cognitive profile for each user.
This profile persists across sessions, conversations, agents, and time.

The Cognitive Core does not speak to users. It exists solely to:
- Observe
- Learn
- Update internal models
- Feed accurate context to agents (MyIntel, MyAdvisor, MySoundboard)
- Track advisory outcomes and escalate ignored advice
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging
import uuid

logger = logging.getLogger(__name__)


class CognitiveCore:
    """
    Per-User Cognitive Core - The persistent intelligence layer.
    
    Four Internal Layers:
    1. Immutable Reality Model - Facts that rarely change
    2. Behavioural Truth Model - How the user ACTUALLY behaves
    3. Delivery Preference Model - HOW support should be delivered
    4. Consequence & Outcome Memory - Records outcomes over time
    
    Plus: Advisory Log - Tracks all recommendations and their outcomes
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.cognitive_profiles
        self.advisory_log = db.advisory_log  # New collection for recommendation tracking
    
    async def get_profile(self, user_id: str) -> Dict[str, Any]:
        """Retrieve or create the cognitive profile for a user."""
        profile = await self.collection.find_one({"user_id": user_id}, {"_id": 0})
        
        if not profile:
            profile = await self._create_initial_profile(user_id)
        
        return profile
    
    # ═══════════════════════════════════════════════════════════════
    # ADVISORY LOG SYSTEM
    # ═══════════════════════════════════════════════════════════════
    
    async def log_recommendation(
        self,
        user_id: str,
        agent: str,
        situation: str,
        recommendation: str,
        reason: str,
        expected_outcome: str,
        topic_tags: List[str] = None,
        urgency: str = "normal",  # normal, elevated, critical
        confidence: str = "medium",  # high, medium, low
        confidence_factors: List[str] = None  # Why this confidence level
    ) -> str:
        """
        Log every recommendation with full context and confidence classification.
        Returns the recommendation ID for future tracking.
        """
        recommendation_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        log_entry = {
            "id": recommendation_id,
            "user_id": user_id,
            "agent": agent,
            "situation": situation,
            "recommendation": recommendation,
            "reason": reason,
            "expected_outcome": expected_outcome,
            "topic_tags": topic_tags or [],
            "urgency": urgency,
            "confidence": confidence,  # high, medium, low
            "confidence_factors": confidence_factors or [],
            "created_at": now,
            "status": "pending",  # pending, acted, ignored, partially_acted
            "times_repeated": 0,
            "escalation_level": 0,  # 0 = normal, 1 = elevated, 2 = critical
            "actual_outcome": None,
            "outcome_recorded_at": None,
            "follow_up_dates": [],
            "user_acknowledged": False
        }
        
        await self.advisory_log.insert_one(log_entry)
        logger.info(f"Logged recommendation {recommendation_id} [{confidence}] for user {user_id}: {recommendation[:50]}...")
        
        return recommendation_id
    
    async def calculate_confidence(self, user_id: str, topic_tags: List[str] = None) -> Dict[str, Any]:
        """
        Calculate confidence level for advice based on data coverage.
        
        Confidence must decrease when data visibility is limited.
        Returns confidence level and the factors affecting it.
        """
        profile = await self.get_profile(user_id)
        
        confidence_score = 0
        max_score = 0
        factors = []
        limiting_factors = []
        
        # ═══════════════════════════════════════════════════════════════
        # FACTOR 1: Business Reality Model Coverage (30 points max)
        # ═══════════════════════════════════════════════════════════════
        max_score += 30
        reality = profile.get("reality_model", {})
        reality_fields = ["business_type", "business_maturity", "industry", 
                         "revenue_model", "cashflow_sensitivity", "time_scarcity"]
        reality_populated = sum(1 for f in reality_fields 
                               if reality.get(f) and reality.get(f) != "unknown")
        reality_score = (reality_populated / len(reality_fields)) * 30
        confidence_score += reality_score
        
        if reality_score >= 25:
            factors.append("Strong business reality understanding")
        elif reality_score >= 15:
            factors.append("Partial business reality data")
        else:
            limiting_factors.append("Limited business reality data - advice may not account for key constraints")
        
        # ═══════════════════════════════════════════════════════════════
        # FACTOR 2: Behavioural Truth Model Coverage (30 points max)
        # ═══════════════════════════════════════════════════════════════
        max_score += 30
        behaviour = profile.get("behavioural_model", {})
        behaviour_fields = ["decision_velocity", "follow_through_reliability", 
                          "stress_tolerance", "information_tolerance"]
        behaviour_populated = sum(1 for f in behaviour_fields 
                                 if behaviour.get(f) and behaviour.get(f) != "unknown")
        behaviour_score = (behaviour_populated / len(behaviour_fields)) * 20
        
        # Bonus for observed patterns
        if behaviour.get("avoidance_patterns"):
            behaviour_score += 5
        if behaviour.get("repeated_concerns"):
            behaviour_score += 5
        
        behaviour_score = min(behaviour_score, 30)
        confidence_score += behaviour_score
        
        if behaviour_score >= 25:
            factors.append("Strong behavioural understanding from observation")
        elif behaviour_score >= 15:
            factors.append("Some behavioural patterns observed")
        else:
            limiting_factors.append("Limited behavioural observation - cannot predict user reaction reliably")
        
        # ═══════════════════════════════════════════════════════════════
        # FACTOR 3: Outcome History (20 points max)
        # ═══════════════════════════════════════════════════════════════
        max_score += 20
        
        # Check advisory log for past outcomes
        past_advice_count = await self.advisory_log.count_documents({
            "user_id": user_id,
            "status": {"$in": ["acted", "ignored"]}
        })
        
        if past_advice_count >= 10:
            confidence_score += 20
            factors.append(f"Strong outcome history ({past_advice_count} tracked recommendations)")
        elif past_advice_count >= 5:
            confidence_score += 12
            factors.append(f"Moderate outcome history ({past_advice_count} tracked recommendations)")
        elif past_advice_count >= 1:
            confidence_score += 5
            limiting_factors.append("Limited outcome history - cannot verify what works for this user")
        else:
            limiting_factors.append("No outcome history - this is speculative advice")
        
        # ═══════════════════════════════════════════════════════════════
        # FACTOR 4: Topic-Specific History (10 points max)
        # ═══════════════════════════════════════════════════════════════
        max_score += 10
        
        if topic_tags:
            topic_advice = await self.get_similar_past_advice(user_id, topic_tags, limit=5)
            if len(topic_advice) >= 3:
                confidence_score += 10
                factors.append(f"Prior experience with this topic ({len(topic_advice)} past recommendations)")
            elif len(topic_advice) >= 1:
                confidence_score += 5
                factors.append("Some prior experience with this topic")
            else:
                limiting_factors.append("No prior advice on this specific topic")
        else:
            limiting_factors.append("Topic not specified - cannot check topic-specific history")
        
        # ═══════════════════════════════════════════════════════════════
        # FACTOR 5: Profile Maturity (10 points max)
        # ═══════════════════════════════════════════════════════════════
        max_score += 10
        observation_count = profile.get("observation_count", 0)
        
        if observation_count >= 100:
            confidence_score += 10
            factors.append("Deep profile (100+ observations)")
        elif observation_count >= 50:
            confidence_score += 7
            factors.append("Mature profile (50+ observations)")
        elif observation_count >= 20:
            confidence_score += 4
            factors.append("Developing profile")
        else:
            limiting_factors.append(f"Nascent profile ({observation_count} observations) - still learning this user")
        
        # ═══════════════════════════════════════════════════════════════
        # CALCULATE FINAL CONFIDENCE LEVEL
        # ═══════════════════════════════════════════════════════════════
        confidence_percentage = (confidence_score / max_score) * 100
        
        if confidence_percentage >= 70:
            confidence_level = "high"
        elif confidence_percentage >= 40:
            confidence_level = "medium"
        else:
            confidence_level = "low"
        
        return {
            "level": confidence_level,
            "score": round(confidence_percentage, 1),
            "factors": factors,
            "limiting_factors": limiting_factors,
            "recommendation": self._get_confidence_guidance(confidence_level, limiting_factors)
        }
    
    def _get_confidence_guidance(self, level: str, limiting_factors: List[str]) -> str:
        """Get guidance on how to adjust response based on confidence."""
        if level == "high":
            return "Proceed with direct, specific advice. Evidence supports confident recommendations."
        elif level == "medium":
            return "Provide advice but acknowledge limitations. Be specific where data exists, cautious where it doesn't."
        else:
            return "LOW CONFIDENCE: Ask clarifying questions before advising. State uncertainty explicitly. Avoid definitive recommendations."
    
    async def calculate_escalation_state(self, user_id: str, topic_tags: List[str] = None) -> Dict[str, Any]:
        """
        Calculate the current escalation state for this user.
        
        Escalation is evidence-based, not emotional:
        - Tracks ignored advice count
        - Tracks risk indicators
        - Determines appropriate tone, urgency, and optionality
        """
        profile = await self.get_profile(user_id)
        
        escalation = {
            "level": 0,  # 0=normal, 1=elevated, 2=high, 3=critical
            "level_name": "normal",
            "tone": "balanced",
            "urgency": "standard",
            "optionality": "normal",
            "focus": "general",
            "evidence": [],
            "recommended_approach": ""
        }
        
        evidence = []
        escalation_score = 0
        
        # ═══════════════════════════════════════════════════════════════
        # EVIDENCE 1: Ignored Advice Count
        # ═══════════════════════════════════════════════════════════════
        ignored_count = await self.advisory_log.count_documents({
            "user_id": user_id,
            "status": "ignored"
        })
        
        if ignored_count >= 5:
            escalation_score += 3
            evidence.append(f"HIGH: {ignored_count} recommendations ignored")
        elif ignored_count >= 3:
            escalation_score += 2
            evidence.append(f"MODERATE: {ignored_count} recommendations ignored")
        elif ignored_count >= 1:
            escalation_score += 1
            evidence.append(f"LOW: {ignored_count} recommendation(s) ignored")
        
        # ═══════════════════════════════════════════════════════════════
        # EVIDENCE 2: Repeated Ignored Advice (same topic)
        # ═══════════════════════════════════════════════════════════════
        if topic_tags:
            topic_ignored = await self.advisory_log.count_documents({
                "user_id": user_id,
                "status": "ignored",
                "topic_tags": {"$in": topic_tags}
            })
            if topic_ignored >= 2:
                escalation_score += 2
                evidence.append(f"REPEATED: Same advice on this topic ignored {topic_ignored}x")
        
        # ═══════════════════════════════════════════════════════════════
        # EVIDENCE 3: Stress Period Duration
        # ═══════════════════════════════════════════════════════════════
        stress_periods = profile.get("outcome_memory", {}).get("stress_periods", [])
        active_stress = [s for s in stress_periods if s.get("recovery") is None]
        if active_stress:
            escalation_score += 1
            evidence.append("STRESS: User currently in stress period")
        
        # ═══════════════════════════════════════════════════════════════
        # EVIDENCE 4: Decision Loops (circling without resolving)
        # ═══════════════════════════════════════════════════════════════
        decision_loops = profile.get("behavioural_model", {}).get("decision_loops", [])
        if len(decision_loops) >= 3:
            escalation_score += 2
            evidence.append(f"LOOPS: {len(decision_loops)} unresolved decision loops")
        elif len(decision_loops) >= 1:
            escalation_score += 1
            evidence.append(f"LOOPS: {len(decision_loops)} unresolved decision loop(s)")
        
        # ═══════════════════════════════════════════════════════════════
        # EVIDENCE 5: Cashflow Sensitivity
        # ═══════════════════════════════════════════════════════════════
        cashflow = profile.get("reality_model", {}).get("cashflow_sensitivity")
        if cashflow == "critical":
            escalation_score += 2
            evidence.append("RISK: Critical cashflow sensitivity")
        elif cashflow == "high":
            escalation_score += 1
            evidence.append("RISK: High cashflow sensitivity")
        
        # ═══════════════════════════════════════════════════════════════
        # EVIDENCE 6: Deferred Decisions Piling Up
        # ═══════════════════════════════════════════════════════════════
        deferred = profile.get("outcome_memory", {}).get("deferred_decisions", [])
        if len(deferred) >= 5:
            escalation_score += 2
            evidence.append(f"BACKLOG: {len(deferred)} deferred decisions")
        elif len(deferred) >= 3:
            escalation_score += 1
            evidence.append(f"BACKLOG: {len(deferred)} deferred decisions")
        
        # ═══════════════════════════════════════════════════════════════
        # CALCULATE ESCALATION LEVEL
        # ═══════════════════════════════════════════════════════════════
        if escalation_score >= 8:
            level = 3
            level_name = "critical"
        elif escalation_score >= 5:
            level = 2
            level_name = "high"
        elif escalation_score >= 2:
            level = 1
            level_name = "elevated"
        else:
            level = 0
            level_name = "normal"
        
        # ═══════════════════════════════════════════════════════════════
        # DETERMINE RESPONSE PARAMETERS
        # ═══════════════════════════════════════════════════════════════
        escalation_params = {
            0: {  # Normal
                "tone": "balanced",
                "urgency": "standard",
                "optionality": "normal",
                "focus": "general guidance",
                "approach": "Standard advisory approach. Balanced tone. Options where appropriate."
            },
            1: {  # Elevated
                "tone": "direct",
                "urgency": "increased",
                "optionality": "reduced",
                "focus": "priority issues",
                "approach": "More direct tone. Clarify consequences. Reduce options to top 2. Focus on priorities."
            },
            2: {  # High
                "tone": "firm",
                "urgency": "high",
                "optionality": "minimal",
                "focus": "critical issues only",
                "approach": "Firm, clear tone. State consequences explicitly. Single recommendation. Focus only on what matters most."
            },
            3: {  # Critical
                "tone": "urgent",
                "urgency": "critical",
                "optionality": "none",
                "focus": "survival",
                "approach": "Urgent, no-nonsense tone. Survival-critical issues only. One action. No options. Clear consequences of inaction."
            }
        }
        
        params = escalation_params[level]
        
        return {
            "level": level,
            "level_name": level_name,
            "score": escalation_score,
            "tone": params["tone"],
            "urgency": params["urgency"],
            "optionality": params["optionality"],
            "focus": params["focus"],
            "evidence": evidence,
            "recommended_approach": params["approach"]
        }
    
    async def get_known_information(self, user_id: str) -> Dict[str, Any]:
        """
        Get all information already known about this user.
        Used to prevent re-asking for information already provided.
        """
        profile = await self.get_profile(user_id)
        
        known = {
            "business_facts": [],
            "behavioural_observations": [],
            "topics_discussed": [],
            "questions_already_asked": [],
            "information_provided_dates": {}
        }
        
        # Collect known business facts
        reality = profile.get("reality_model", {})
        for field, value in reality.items():
            if value and value != "unknown" and field not in ["confidence_level", "last_updated"]:
                known["business_facts"].append(f"{field}: {value}")
                known["information_provided_dates"][field] = reality.get("last_updated")
        
        # Collect behavioural observations
        behaviour = profile.get("behavioural_model", {})
        for field, value in behaviour.items():
            if value and value != "unknown" and field not in ["confidence_level", "last_updated", "action_patterns", "energy_cycles"]:
                if isinstance(value, list) and value:
                    known["behavioural_observations"].append(f"{field}: {', '.join(value[:3])}")
                elif not isinstance(value, (list, dict)):
                    known["behavioural_observations"].append(f"{field}: {value}")
        
        # Collect topics discussed
        topics = profile.get("learning_signals", {}).get("topics_discussed", {})
        known["topics_discussed"] = list(topics.keys())
        
        return known
    
    async def record_question_asked(self, user_id: str, question: str, topic: str = None) -> None:
        """Record that a question was asked to prevent re-asking."""
        now = datetime.now(timezone.utc).isoformat()
        
        await self.collection.update_one(
            {"user_id": user_id},
            {
                "$push": {
                    "questions_asked": {
                        "$each": [{
                            "question": question,
                            "topic": topic,
                            "asked_at": now
                        }],
                        "$slice": -50  # Keep last 50 questions
                    }
                }
            }
        )
    
    async def get_questions_asked(self, user_id: str) -> List[Dict]:
        """Get questions previously asked to this user."""
        profile = await self.get_profile(user_id)
        return profile.get("questions_asked", [])
    
    async def check_if_already_known(self, user_id: str, information_type: str) -> bool:
        """Check if a piece of information is already known."""
        profile = await self.get_profile(user_id)
        
        reality = profile.get("reality_model", {})
        behaviour = profile.get("behavioural_model", {})
        
        # Check reality model
        if information_type in reality:
            value = reality.get(information_type)
            if value and value != "unknown":
                return True
        
        # Check behavioural model
        if information_type in behaviour:
            value = behaviour.get(information_type)
            if value and value != "unknown":
                return True
        
        return False
    
    async def record_recommendation_outcome(
        self,
        recommendation_id: str,
        status: str,  # acted, ignored, partially_acted
        actual_outcome: str = None,
        notes: str = None
    ) -> None:
        """Record whether advice was acted on and what happened."""
        now = datetime.now(timezone.utc).isoformat()
        
        update = {
            "$set": {
                "status": status,
                "outcome_recorded_at": now
            }
        }
        
        if actual_outcome:
            update["$set"]["actual_outcome"] = actual_outcome
        if notes:
            update["$set"]["outcome_notes"] = notes
        
        await self.advisory_log.update_one(
            {"id": recommendation_id},
            update
        )
        
        # If ignored, increment the counter for escalation tracking
        if status == "ignored":
            await self.advisory_log.update_one(
                {"id": recommendation_id},
                {"$inc": {"times_repeated": 1}}
            )
    
    async def get_similar_past_advice(
        self,
        user_id: str,
        topic_tags: List[str],
        limit: int = 5
    ) -> List[Dict]:
        """
        Get past recommendations on similar topics to inform future guidance.
        Returns advice that succeeded or failed previously.
        """
        if not topic_tags:
            return []
        
        cursor = self.advisory_log.find(
            {
                "user_id": user_id,
                "topic_tags": {"$in": topic_tags},
                "status": {"$in": ["acted", "ignored", "partially_acted"]}
            },
            {"_id": 0}
        ).sort("created_at", -1).limit(limit)
        
        return await cursor.to_list(length=limit)
    
    async def get_ignored_advice_for_escalation(
        self,
        user_id: str,
        topic_tags: List[str] = None
    ) -> List[Dict]:
        """
        Get advice that has been repeatedly ignored and needs escalation.
        Repeatedly ignored advice must escalate in clarity or urgency.
        """
        query = {
            "user_id": user_id,
            "status": "ignored",
            "times_repeated": {"$gte": 1}
        }
        
        if topic_tags:
            query["topic_tags"] = {"$in": topic_tags}
        
        cursor = self.advisory_log.find(
            query,
            {"_id": 0}
        ).sort("times_repeated", -1).limit(10)
        
        return await cursor.to_list(length=10)
    
    async def escalate_ignored_advice(
        self,
        recommendation_id: str
    ) -> int:
        """
        Escalate ignored advice to higher urgency level.
        Returns the new escalation level.
        """
        # Get current level
        rec = await self.advisory_log.find_one({"id": recommendation_id}, {"_id": 0})
        if not rec:
            return 0
        
        current_level = rec.get("escalation_level", 0)
        new_level = min(current_level + 1, 2)  # Max level is 2 (critical)
        
        urgency_map = {0: "normal", 1: "elevated", 2: "critical"}
        
        await self.advisory_log.update_one(
            {"id": recommendation_id},
            {
                "$set": {
                    "escalation_level": new_level,
                    "urgency": urgency_map[new_level]
                },
                "$inc": {"times_repeated": 1},
                "$push": {"follow_up_dates": datetime.now(timezone.utc).isoformat()}
            }
        )
        
        logger.info(f"Escalated recommendation {recommendation_id} to level {new_level}")
        return new_level
    
    async def get_advisory_context_for_topic(
        self,
        user_id: str,
        topic_tags: List[str]
    ) -> Dict[str, Any]:
        """
        Build advisory context for a topic, including:
        - Past similar advice and outcomes
        - Ignored advice needing escalation
        - Success/failure patterns
        """
        similar_advice = await self.get_similar_past_advice(user_id, topic_tags)
        ignored_advice = await self.get_ignored_advice_for_escalation(user_id, topic_tags)
        
        # Calculate success rate for this topic
        acted_count = sum(1 for a in similar_advice if a.get("status") == "acted")
        ignored_count = sum(1 for a in similar_advice if a.get("status") == "ignored")
        total = acted_count + ignored_count
        
        success_rate = acted_count / total if total > 0 else None
        
        # Find patterns
        successful_approaches = [
            a for a in similar_advice 
            if a.get("status") == "acted" and a.get("actual_outcome") in ["positive", "successful"]
        ]
        
        failed_approaches = [
            a for a in similar_advice 
            if a.get("status") == "acted" and a.get("actual_outcome") in ["negative", "failed"]
        ]
        
        return {
            "similar_past_advice": similar_advice,
            "ignored_needing_escalation": ignored_advice,
            "topic_action_rate": success_rate,
            "successful_approaches": successful_approaches[:3],
            "failed_approaches": failed_approaches[:3],
            "has_escalation_candidates": len(ignored_advice) > 0
        }
    
    # ═══════════════════════════════════════════════════════════════
    # ORIGINAL METHODS (unchanged)
    # ═══════════════════════════════════════════════════════════════
    
    async def _create_initial_profile(self, user_id: str) -> Dict[str, Any]:
        """Create initial cognitive profile with conservative defaults."""
        now = datetime.now(timezone.utc).isoformat()
        
        profile = {
            "user_id": user_id,
            "created_at": now,
            "last_updated": now,
            "observation_count": 0,
            
            # LAYER 1: Immutable Reality Model
            # Facts that rarely change - prevents unrealistic advice
            "reality_model": {
                "business_type": None,           # e.g., "service", "product", "marketplace"
                "business_maturity": None,       # e.g., "idea", "early", "growth", "mature"
                "industry": None,
                "industry_constraints": [],      # regulatory, seasonal, etc.
                "revenue_model": None,           # subscription, project, hourly, etc.
                "cashflow_sensitivity": "unknown",  # low, medium, high, critical
                "risk_exposure": "unknown",      # low, medium, high
                "regulatory_pressure": "unknown", # none, light, moderate, heavy
                "time_scarcity": "unknown",      # abundant, normal, scarce, critical
                "decision_ownership": "unknown", # solo, shared, delegated
                "team_size": None,
                "years_operating": None,
                "confidence_level": 0.0,         # 0-1 confidence in this layer
                "last_updated": now
            },
            
            # LAYER 2: Behavioural Truth Model
            # How the user ACTUALLY behaves - observed, not stated
            "behavioural_model": {
                "decision_velocity": "unknown",      # fast, cautious, frozen
                "follow_through_reliability": "unknown",  # high, moderate, low
                "avoidance_patterns": [],           # topics/decisions they avoid
                "stress_tolerance": "unknown",      # high, moderate, low
                "energy_cycles": {                  # when they're most engaged
                    "peak_hours": [],
                    "low_hours": [],
                    "peak_days": []
                },
                "information_tolerance": "unknown", # brief, moderate, deep
                "repeated_concerns": [],            # topics that keep coming up
                "decision_loops": [],               # decisions they circle back to
                "action_patterns": {
                    "total_advice_given": 0,
                    "advice_acted_on": 0,
                    "advice_ignored": 0,
                    "average_action_delay_days": None
                },
                "confidence_level": 0.0,
                "last_updated": now
            },
            
            # LAYER 3: Delivery Preference Model
            # HOW support should be delivered - controls tone, timing, depth
            "delivery_model": {
                "communication_style": "unknown",   # blunt, framed, gentle
                "pressure_sensitivity": "unknown",  # low, moderate, high
                "reassurance_need": "unknown",      # none, occasional, frequent
                "momentum_preference": "unknown",   # steady, urgent, relaxed
                "interruption_tolerance": "unknown", # high, moderate, low
                "support_cadence": "unknown",       # daily, weekly, as-needed
                "depth_preference": "unknown",      # surface, moderate, deep
                "response_length_preference": "unknown",  # brief, moderate, detailed
                "confidence_level": 0.0,
                "last_updated": now
            },
            
            # LAYER 4: Consequence & Outcome Memory
            # Records outcomes over time - generates personalised wisdom
            "outcome_memory": {
                "advice_outcomes": [],  # {advice, action_taken, result, timestamp}
                "ignored_signals": [],  # {signal, downstream_impact, timestamp}
                "deferred_decisions": [],  # {decision, opportunity_cost, timestamp}
                "stress_periods": [],   # {trigger, duration_days, recovery, timestamp}
                "strategic_shifts": [], # {shift, business_effect, timestamp}
                "wins": [],             # positive outcomes to reference
                "lessons": [],          # learned patterns
                "last_updated": now
            },
            
            # Meta-learning signals
            "learning_signals": {
                "total_interactions": 0,
                "last_interaction": None,
                "session_count": 0,
                "average_session_length_mins": None,
                "topics_discussed": {},  # topic -> frequency
                "sentiment_trend": [],   # rolling sentiment observations
                "engagement_trend": []   # rolling engagement observations
            }
        }
        
        await self.collection.insert_one(profile)
        logger.info(f"Created initial cognitive profile for user {user_id}")
        return profile
    
    async def observe(self, user_id: str, observation: Dict[str, Any]) -> None:
        """
        Record an observation about the user. Learning is passive and continuous.
        
        Observation types:
        - message: User sent a message
        - action: User took an action
        - decision: User made a decision
        - avoidance: User avoided something
        - outcome: Result of previous advice/action
        - sentiment: Emotional signal detected
        - timing: Timing-based observation
        """
        now = datetime.now(timezone.utc).isoformat()
        observation["timestamp"] = now
        
        # Get current profile
        profile = await self.get_profile(user_id)
        
        obs_type = observation.get("type")
        
        if obs_type == "message":
            await self._observe_message(user_id, profile, observation)
        elif obs_type == "action":
            await self._observe_action(user_id, profile, observation)
        elif obs_type == "decision":
            await self._observe_decision(user_id, profile, observation)
        elif obs_type == "avoidance":
            await self._observe_avoidance(user_id, profile, observation)
        elif obs_type == "outcome":
            await self._observe_outcome(user_id, profile, observation)
        elif obs_type == "sentiment":
            await self._observe_sentiment(user_id, profile, observation)
        elif obs_type == "timing":
            await self._observe_timing(user_id, profile, observation)
        elif obs_type == "reality_update":
            await self._update_reality_model(user_id, profile, observation)
        
        # Increment observation count
        await self.collection.update_one(
            {"user_id": user_id},
            {
                "$inc": {"observation_count": 1},
                "$set": {
                    "last_updated": now,
                    "learning_signals.last_interaction": now
                }
            }
        )
    
    async def _observe_message(self, user_id: str, profile: Dict, obs: Dict) -> None:
        """Observe patterns in user messages."""
        message = obs.get("content", "")
        
        # Track topics discussed
        topics = obs.get("topics", [])
        topic_updates = {}
        for topic in topics:
            key = f"learning_signals.topics_discussed.{topic}"
            topic_updates[key] = profile.get("learning_signals", {}).get("topics_discussed", {}).get(topic, 0) + 1
        
        if topic_updates:
            await self.collection.update_one(
                {"user_id": user_id},
                {"$inc": topic_updates}
            )
        
        # Detect repeated concerns
        if obs.get("is_repeated_concern"):
            concern = obs.get("concern_topic")
            await self.collection.update_one(
                {"user_id": user_id},
                {"$addToSet": {"behavioural_model.repeated_concerns": concern}}
            )
        
        # Infer information tolerance from message length patterns
        msg_length = len(message)
        if msg_length < 50:
            length_signal = "brief"
        elif msg_length < 200:
            length_signal = "moderate"
        else:
            length_signal = "deep"
        
        # Update with weighted inference (don't overwrite immediately)
        current_pref = profile.get("delivery_model", {}).get("information_tolerance", "unknown")
        if current_pref == "unknown":
            await self.collection.update_one(
                {"user_id": user_id},
                {"$set": {"delivery_model.information_tolerance": length_signal}}
            )
    
    async def _observe_action(self, user_id: str, profile: Dict, obs: Dict) -> None:
        """Observe when user takes action on advice."""
        action_type = obs.get("action_type")
        related_advice_id = obs.get("advice_id")
        delay_days = obs.get("delay_days", 0)
        
        updates = {
            "behavioural_model.action_patterns.total_advice_given": 1
        }
        
        if action_type == "acted":
            updates["behavioural_model.action_patterns.advice_acted_on"] = 1
            
            # Update follow-through reliability
            acted = profile.get("behavioural_model", {}).get("action_patterns", {}).get("advice_acted_on", 0) + 1
            total = profile.get("behavioural_model", {}).get("action_patterns", {}).get("total_advice_given", 0) + 1
            
            if total >= 3:  # Need minimum observations
                ratio = acted / total
                reliability = "high" if ratio > 0.7 else "moderate" if ratio > 0.4 else "low"
                await self.collection.update_one(
                    {"user_id": user_id},
                    {"$set": {"behavioural_model.follow_through_reliability": reliability}}
                )
        elif action_type == "ignored":
            updates["behavioural_model.action_patterns.advice_ignored"] = 1
        
        await self.collection.update_one(
            {"user_id": user_id},
            {"$inc": updates}
        )
        
        # Infer decision velocity from delay
        if delay_days is not None:
            if delay_days < 1:
                velocity = "fast"
            elif delay_days < 7:
                velocity = "cautious"
            else:
                velocity = "frozen"
            
            await self.collection.update_one(
                {"user_id": user_id},
                {"$set": {"behavioural_model.decision_velocity": velocity}}
            )
    
    async def _observe_decision(self, user_id: str, profile: Dict, obs: Dict) -> None:
        """Observe decision patterns."""
        decision = obs.get("decision")
        decision_type = obs.get("decision_type")  # made, deferred, avoided
        
        if decision_type == "deferred":
            deferred_entry = {
                "decision": decision,
                "timestamp": obs.get("timestamp"),
                "opportunity_cost": obs.get("opportunity_cost")
            }
            await self.collection.update_one(
                {"user_id": user_id},
                {"$push": {"outcome_memory.deferred_decisions": deferred_entry}}
            )
        
        # Track decision loops (same decision coming up repeatedly)
        if obs.get("is_recurring"):
            await self.collection.update_one(
                {"user_id": user_id},
                {"$addToSet": {"behavioural_model.decision_loops": decision}}
            )
    
    async def _observe_avoidance(self, user_id: str, profile: Dict, obs: Dict) -> None:
        """Observe avoidance patterns."""
        avoided_topic = obs.get("topic")
        
        await self.collection.update_one(
            {"user_id": user_id},
            {"$addToSet": {"behavioural_model.avoidance_patterns": avoided_topic}}
        )
    
    async def _observe_outcome(self, user_id: str, profile: Dict, obs: Dict) -> None:
        """Record outcomes of advice/actions for learning."""
        outcome_entry = {
            "advice": obs.get("advice"),
            "action_taken": obs.get("action_taken"),
            "result": obs.get("result"),  # positive, negative, neutral
            "details": obs.get("details"),
            "timestamp": obs.get("timestamp")
        }
        
        await self.collection.update_one(
            {"user_id": user_id},
            {"$push": {"outcome_memory.advice_outcomes": outcome_entry}}
        )
        
        # Track wins for positive reinforcement
        if obs.get("result") == "positive":
            await self.collection.update_one(
                {"user_id": user_id},
                {"$push": {"outcome_memory.wins": {
                    "summary": obs.get("details"),
                    "timestamp": obs.get("timestamp")
                }}}
            )
        
        # Extract lessons from negative outcomes
        if obs.get("result") == "negative" and obs.get("lesson"):
            await self.collection.update_one(
                {"user_id": user_id},
                {"$push": {"outcome_memory.lessons": {
                    "lesson": obs.get("lesson"),
                    "context": obs.get("details"),
                    "timestamp": obs.get("timestamp")
                }}}
            )
    
    async def _observe_sentiment(self, user_id: str, profile: Dict, obs: Dict) -> None:
        """Observe emotional signals."""
        sentiment = obs.get("sentiment")  # stressed, confident, uncertain, frustrated, calm
        
        # Add to rolling trend (keep last 20)
        await self.collection.update_one(
            {"user_id": user_id},
            {
                "$push": {
                    "learning_signals.sentiment_trend": {
                        "$each": [{"sentiment": sentiment, "timestamp": obs.get("timestamp")}],
                        "$slice": -20
                    }
                }
            }
        )
        
        # Detect stress periods
        if sentiment == "stressed":
            # Check if already in a stress period
            stress_periods = profile.get("outcome_memory", {}).get("stress_periods", [])
            recent_stress = [s for s in stress_periods if s.get("recovery") is None]
            
            if not recent_stress:
                await self.collection.update_one(
                    {"user_id": user_id},
                    {"$push": {"outcome_memory.stress_periods": {
                        "trigger": obs.get("trigger"),
                        "start_timestamp": obs.get("timestamp"),
                        "recovery": None
                    }}}
                )
        elif sentiment in ["calm", "confident"]:
            # Mark recovery from stress
            await self.collection.update_one(
                {"user_id": user_id,
                 "outcome_memory.stress_periods.recovery": None},
                {"$set": {"outcome_memory.stress_periods.$.recovery": obs.get("timestamp")}}
            )
    
    async def _observe_timing(self, user_id: str, profile: Dict, obs: Dict) -> None:
        """Observe timing patterns (when user is most engaged)."""
        hour = obs.get("hour")
        day = obs.get("day")
        engagement_level = obs.get("engagement")  # high, medium, low
        
        if engagement_level == "high" and hour:
            await self.collection.update_one(
                {"user_id": user_id},
                {"$addToSet": {"behavioural_model.energy_cycles.peak_hours": hour}}
            )
        
        if engagement_level == "high" and day:
            await self.collection.update_one(
                {"user_id": user_id},
                {"$addToSet": {"behavioural_model.energy_cycles.peak_days": day}}
            )
    
    async def _update_reality_model(self, user_id: str, profile: Dict, obs: Dict) -> None:
        """Update immutable reality model with new facts."""
        updates = {}
        
        for field in ["business_type", "business_maturity", "industry", "revenue_model",
                      "cashflow_sensitivity", "risk_exposure", "regulatory_pressure",
                      "time_scarcity", "decision_ownership", "team_size", "years_operating"]:
            if obs.get(field) is not None:
                updates[f"reality_model.{field}"] = obs.get(field)
        
        if obs.get("industry_constraints"):
            await self.collection.update_one(
                {"user_id": user_id},
                {"$addToSet": {"reality_model.industry_constraints": {"$each": obs.get("industry_constraints")}}}
            )
        
        if updates:
            updates["reality_model.last_updated"] = datetime.now(timezone.utc).isoformat()
            # Increase confidence as we learn more
            current_confidence = profile.get("reality_model", {}).get("confidence_level", 0)
            updates["reality_model.confidence_level"] = min(1.0, current_confidence + 0.1)
            
            await self.collection.update_one(
                {"user_id": user_id},
                {"$set": updates}
            )
    
    async def get_context_for_agent(self, user_id: str, agent: str) -> Dict[str, Any]:
        """
        Generate context for an agent based on cognitive profile.
        
        All agents (MyIntel, MyAdvisor, MySoundboard) MUST reference this
        before generating any output.
        """
        profile = await self.get_profile(user_id)
        
        # Build context optimised for the specific agent
        context = {
            "user_id": user_id,
            "profile_maturity": self._calculate_profile_maturity(profile),
            
            # Reality constraints (prevents unrealistic advice)
            "reality": {
                "business_type": profile.get("reality_model", {}).get("business_type"),
                "maturity": profile.get("reality_model", {}).get("business_maturity"),
                "cashflow_sensitivity": profile.get("reality_model", {}).get("cashflow_sensitivity"),
                "time_scarcity": profile.get("reality_model", {}).get("time_scarcity"),
                "decision_ownership": profile.get("reality_model", {}).get("decision_ownership"),
                "constraints": profile.get("reality_model", {}).get("industry_constraints", [])
            },
            
            # Behavioural truth (how they actually behave)
            "behaviour": {
                "decision_velocity": profile.get("behavioural_model", {}).get("decision_velocity"),
                "follow_through": profile.get("behavioural_model", {}).get("follow_through_reliability"),
                "avoids": profile.get("behavioural_model", {}).get("avoidance_patterns", []),
                "repeated_concerns": profile.get("behavioural_model", {}).get("repeated_concerns", []),
                "decision_loops": profile.get("behavioural_model", {}).get("decision_loops", [])
            },
            
            # Delivery preferences (how to communicate)
            "delivery": {
                "style": profile.get("delivery_model", {}).get("communication_style"),
                "pressure_sensitivity": profile.get("delivery_model", {}).get("pressure_sensitivity"),
                "depth": profile.get("delivery_model", {}).get("depth_preference"),
                "interruption_tolerance": profile.get("delivery_model", {}).get("interruption_tolerance")
            },
            
            # Outcome memory (personalised wisdom)
            "history": {
                "recent_wins": profile.get("outcome_memory", {}).get("wins", [])[-3:],
                "lessons": profile.get("outcome_memory", {}).get("lessons", [])[-5:],
                "deferred_decisions": profile.get("outcome_memory", {}).get("deferred_decisions", [])[-3:],
                "in_stress_period": self._is_in_stress_period(profile)
            }
        }
        
        # Agent-specific context additions
        if agent == "MyIntel":
            # MyIntel needs to know what signals to surface
            context["intel_focus"] = {
                "topics_of_interest": list(profile.get("learning_signals", {}).get("topics_discussed", {}).keys())[:10],
                "avoidance_blind_spots": profile.get("behavioural_model", {}).get("avoidance_patterns", [])
            }
        
        elif agent == "MyAdvisor":
            # MyAdvisor needs outcome history for personalised advice
            context["advisor_focus"] = {
                "action_success_rate": self._calculate_action_rate(profile),
                "advice_outcomes": profile.get("outcome_memory", {}).get("advice_outcomes", [])[-5:]
            }
        
        elif agent == "MySoundboard":
            # MySoundboard needs emotional and reflection context
            context["soundboard_focus"] = {
                "recent_sentiment": profile.get("learning_signals", {}).get("sentiment_trend", [])[-5:],
                "unresolved_loops": profile.get("behavioural_model", {}).get("decision_loops", [])
            }
        
        return context
    
    def _calculate_profile_maturity(self, profile: Dict) -> str:
        """Calculate how mature/confident the profile is."""
        observation_count = profile.get("observation_count", 0)
        
        if observation_count < 10:
            return "nascent"
        elif observation_count < 50:
            return "developing"
        elif observation_count < 200:
            return "mature"
        else:
            return "deep"
    
    def _is_in_stress_period(self, profile: Dict) -> bool:
        """Check if user is currently in a stress period."""
        stress_periods = profile.get("outcome_memory", {}).get("stress_periods", [])
        return any(s.get("recovery") is None for s in stress_periods)
    
    def _calculate_action_rate(self, profile: Dict) -> Optional[float]:
        """Calculate the rate at which user acts on advice."""
        action_patterns = profile.get("behavioural_model", {}).get("action_patterns", {})
        total = action_patterns.get("total_advice_given", 0)
        acted = action_patterns.get("advice_acted_on", 0)
        
        if total < 3:
            return None
        return round(acted / total, 2)


# Singleton instance - initialized in server.py
cognitive_core: Optional[CognitiveCore] = None


def init_cognitive_core(db: AsyncIOMotorDatabase) -> CognitiveCore:
    """Initialize the cognitive core singleton."""
    global cognitive_core
    cognitive_core = CognitiveCore(db)
    return cognitive_core


def get_cognitive_core() -> CognitiveCore:
    """Get the cognitive core instance."""
    if cognitive_core is None:
        raise RuntimeError("Cognitive core not initialized")
    return cognitive_core
