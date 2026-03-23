"""
Per-User Cognitive Core - SUPABASE VERSION
========================
Maintains a continuously evolving, non-resetting cognitive profile for each user.
This profile persists across sessions, conversations, agents, and time.

MIGRATED TO: Supabase PostgreSQL
- Uses JSONB columns for flexible schema
- Maintains all 4 cognitive layers
- Compatible with OAuth authentication

The Cognitive Core does not speak to users. It exists solely to:
- Observe
- Learn
- Update internal models
- Feed accurate context to agents (MyIntel, MyAdvisor, MySoundboard)
- Track advisory outcomes and escalate ignored advice
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from supabase import Client
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
    
    SUPABASE IMPLEMENTATION:
    - Uses 'cognitive_profiles' table with JSONB columns
    - Uses 'advisory_log' table for recommendations
    """
    
    def __init__(self, supabase_client: Client):
        """Initialize with Supabase client"""
        self.supabase = supabase_client
        logger.info("Cognitive Core initialized with Supabase PostgreSQL")
    
    # ═══════════════════════════════════════════════════════════════
    # PHASE 1: CORE PROFILE OPERATIONS
    # ═══════════════════════════════════════════════════════════════
    
    async def get_profile(self, user_id: str) -> Dict[str, Any]:
        """
        Retrieve or create the cognitive profile for a user.
        
        SUPABASE: Queries cognitive_profiles table
        Returns JSONB fields as Python dicts
        """
        try:
            response = self.supabase.table("cognitive_profiles").select("*").eq("user_id", user_id).execute()
            
            if response.data and len(response.data) > 0:
                profile = response.data[0]
                logger.debug(f"Retrieved cognitive profile for user {user_id}")
                return profile
            else:
                # Profile doesn't exist - create it
                logger.info(f"No profile found for user {user_id}, creating initial profile")
                profile = await self._create_initial_profile(user_id)
                return profile
                
        except Exception as e:
            logger.error(f"Error getting cognitive profile for user {user_id}: {e}")
            # Create and return basic profile on error
            return await self._create_initial_profile(user_id)
    
    async def _create_initial_profile(self, user_id: str) -> Dict[str, Any]:
        """
        Create initial cognitive profile with conservative defaults.
        
        SUPABASE: Inserts into cognitive_profiles table
        All 4 layers stored as JSONB
        """
        now = datetime.now(timezone.utc).isoformat()
        
        # Layer 1: Immutable Reality Model
        immutable_reality = {
            "business_type": None,
            "business_maturity": None,
            "industry": None,
            "industry_constraints": [],
            "revenue_model": None,
            "cashflow_sensitivity": "unknown",
            "risk_exposure": "unknown",
            "regulatory_pressure": "unknown",
            "time_scarcity": "unknown",
            "decision_ownership": "unknown",
            "team_size": None,
            "years_operating": None,
            "confidence_level": 0.0,
            "last_updated": now
        }
        
        # Layer 2: Behavioural Truth Model
        behavioural_truth = {
            "decision_velocity": "unknown",
            "follow_through_reliability": "unknown",
            "avoidance_patterns": [],
            "stress_tolerance": "unknown",
            "energy_cycles": {
                "peak_hours": [],
                "low_hours": [],
                "peak_days": []
            },
            "information_tolerance": "unknown",
            "repeated_concerns": [],
            "decision_loops": [],
            "action_patterns": {
                "total_advice_given": 0,
                "advice_acted_on": 0,
                "advice_ignored": 0,
                "average_action_delay_days": None
            },
            "confidence_level": 0.0,
            "last_updated": now
        }
        
        # Layer 3: Delivery Preference Model
        delivery_preference = {
            "communication_style": "unknown",
            "pressure_sensitivity": "unknown",
            "reassurance_need": "unknown",
            "momentum_preference": "unknown",
            "interruption_tolerance": "unknown",
            "support_cadence": "unknown",
            "depth_preference": "unknown",
            "response_length_preference": "unknown",
            "confidence_level": 0.0,
            "last_updated": now
        }
        
        # Layer 4: Consequence & Outcome Memory
        consequence_memory = {
            "advice_outcomes": [],
            "ignored_signals": [],
            "deferred_decisions": [],
            "stress_periods": [],
            "strategic_shifts": [],
            "wins": [],
            "lessons": [],
            "last_updated": now
        }
        
        # Complete profile structure
        profile_data = {
            "user_id": user_id,
            "immutable_reality": immutable_reality,
            "behavioural_truth": behavioural_truth,
            "delivery_preference": delivery_preference,
            "consequence_memory": consequence_memory,
            "last_updated": now
        }
        
        try:
            # Insert into Supabase cognitive_profiles table
            response = self.supabase.table("cognitive_profiles").insert(profile_data).execute()
            
            if response.data and len(response.data) > 0:
                created_profile = response.data[0]
                logger.info(f"✅ Created initial cognitive profile for user {user_id} in Supabase")
                return created_profile
            else:
                logger.error(f"Failed to create profile in Supabase for user {user_id} - no data returned")
                # Return in-memory version as fallback
                return profile_data
                
        except Exception as e:
            logger.error(f"❌ Error creating profile in Supabase for user {user_id}: {e}")
            # Return in-memory profile - application can continue, will retry on next call
            return profile_data
    
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
        urgency: str = "normal",
        confidence: str = "medium",
        confidence_factors: List[str] = None
    ) -> str:
        """Log recommendation in advisory_log table - Returns recommendation_id"""
        recommendation_id = str(uuid.uuid4())
        
        log_entry = {
            "recommendation_id": recommendation_id,
            "user_id": user_id,
            "agent": agent,
            "situation": situation,
            "recommendation": recommendation,
            "reason": reason,
            "expected_outcome": expected_outcome,
            "topic_tags": topic_tags or [],
            "urgency": urgency,
            "confidence": confidence,
            "confidence_factors": confidence_factors or []
        }
        
        try:
            self.supabase.table("advisory_log").insert(log_entry).execute()
            logger.info(f"Logged recommendation {recommendation_id} [{confidence}] for user {user_id}")
            return recommendation_id
        except Exception as e:
            logger.error(f"Error logging recommendation: {e}")
            return recommendation_id
    
    async def record_recommendation_outcome(
        self,
        recommendation_id: str,
        status: str,
        actual_outcome: str = None,
        notes: str = None
    ) -> None:
        """Record whether advice was acted on"""
        try:
            updates = {
                "status": status,
                "outcome_recorded_at": datetime.now(timezone.utc).isoformat()
            }
            
            if actual_outcome:
                updates["actual_outcome"] = actual_outcome
            
            self.supabase.table("advisory_log").update(updates).eq("recommendation_id", recommendation_id).execute()
            
            # If ignored, increment counter
            if status == "ignored":
                result = self.supabase.table("advisory_log").select("times_repeated").eq("recommendation_id", recommendation_id).single().execute()
                if result.data:
                    new_count = result.data.get("times_repeated", 0) + 1
                    self.supabase.table("advisory_log").update({"times_repeated": new_count}).eq("recommendation_id", recommendation_id).execute()
                    
        except Exception as e:
            logger.error(f"Error recording outcome: {e}")
    
    async def get_ignored_advice_for_escalation(
        self,
        user_id: str,
        topic_tags: List[str] = None
    ) -> List[Dict]:
        """Get advice that has been repeatedly ignored"""
        try:
            query = self.supabase.table("advisory_log").select("*").eq("user_id", user_id).eq("status", "ignored").gte("times_repeated", 1)
            
            if topic_tags:
                query = query.contains("topic_tags", topic_tags)
            
            result = query.order("times_repeated", desc=True).limit(10).execute()
            return result.data if result.data else []
        except Exception as e:
            logger.error(f"Error getting ignored advice: {e}")
            return []
    
    async def escalate_ignored_advice(self, recommendation_id: str) -> int:
        """Escalate ignored advice to higher urgency level"""
        try:
            result = self.supabase.table("advisory_log").select("escalation_level").eq("recommendation_id", recommendation_id).single().execute()
            
            if not result.data:
                return 0
            
            current_level = result.data.get("escalation_level", 0)
            new_level = min(current_level + 1, 2)
            
            urgency_map = {0: "normal", 1: "elevated", 2: "critical"}
            
            self.supabase.table("advisory_log").update({
                "escalation_level": new_level,
                "urgency": urgency_map[new_level]
            }).eq("recommendation_id", recommendation_id).execute()
            
            logger.info(f"Escalated recommendation {recommendation_id} to level {new_level}")
            return new_level
        except Exception as e:
            logger.error(f"Error escalating advice: {e}")
            return 0
    
    async def get_context_for_agent(self, user_id: str, agent: str) -> Dict[str, Any]:
        """Generate context for an agent based on cognitive profile - SIMPLIFIED FOR SUPABASE"""
        profile = await self.get_profile(user_id)
        
        # Build context from JSONB fields
        context = {
            "user_id": user_id,
            "reality": profile.get("immutable_reality", {}),
            "behaviour": profile.get("behavioural_truth", {}),
            "delivery": profile.get("delivery_preference", {}),
            "history": profile.get("consequence_memory", {})
        }
        
        return context
    
    async def observe(self, user_id: str, observation: Dict[str, Any]) -> None:
        """
        Record observation about user - SIMPLIFIED SUPABASE VERSION
        Stores observation without complex nested updates for now
        """
        try:
            obs_type = observation.get("type")
            obs_layer = observation.get("layer")
            obs_payload = observation.get("payload", {})
            now = datetime.now(timezone.utc).isoformat()

            profile = await self.get_profile(user_id)

            updates: Dict[str, Any] = {
                "last_updated": now
            }

            if obs_layer in [
                "immutable_reality",
                "behavioural_truth",
                "delivery_preference",
                "consequence_memory"
            ] and isinstance(obs_payload, dict):
                base_layer = profile.get(obs_layer, {}) or {}
                merged_layer = {**base_layer, **obs_payload, "last_updated": now}
                updates[obs_layer] = merged_layer

            self.supabase.table("cognitive_profiles").update(updates).eq("user_id", user_id).execute()

            logger.debug(f"Observation recorded for user {user_id}: {obs_type}")
        except Exception as e:
            logger.error(f"Error recording observation: {e}")
    
    async def calculate_confidence(self, user_id: str, topic_tags: List[str] = None) -> Dict[str, Any]:
        """Calculate confidence level - SIMPLIFIED"""
        # Return medium confidence for now
        return {
            "level": "medium",
            "score": 50.0,
            "factors": ["Supabase migration in progress"],
            "limiting_factors": [],
            "recommendation": "Provide balanced advice with acknowledgment of limitations"
        }
    
    async def calculate_escalation_state(self, user_id: str, topic_tags: List[str] = None) -> Dict[str, Any]:
        """Calculate escalation state - SIMPLIFIED"""
        # Check for ignored advice
        ignored_count = 0
        try:
            result = self.supabase.table("advisory_log").select("id", count="exact").eq("user_id", user_id).eq("status", "ignored").execute()
            ignored_count = result.count if result.count else 0
        except:
            pass
        
        level = 0 if ignored_count < 3 else 1 if ignored_count < 5 else 2
        
        return {
            "level": level,
            "level_name": ["normal", "elevated", "critical"][level],
            "tone": "balanced",
            "urgency": "standard",
            "evidence": [f"{ignored_count} recommendations ignored"] if ignored_count > 0 else []
        }
    
    async def get_known_information(self, user_id: str) -> Dict[str, Any]:
        """Get known information about user"""
        profile = await self.get_profile(user_id)
        return {
            "reality": profile.get("immutable_reality", {}),
            "behaviour": profile.get("behavioural_truth", {})
        }
    
    async def get_questions_asked(self, user_id: str) -> List[Dict]:
        """Get questions asked to user - STUB"""
        return []


# ═══════════════════════════════════════════════════════════════
# INITIALIZATION - Singleton Pattern
# ═══════════════════════════════════════════════════════════════

cognitive_core: Optional[CognitiveCore] = None


def init_cognitive_core(supabase_client: Client) -> CognitiveCore:
    """
    Initialize the cognitive core singleton with Supabase client.
    
    Called once at application startup from server.py
    """
    global cognitive_core
    cognitive_core = CognitiveCore(supabase_client)
    logger.info("🧠 Cognitive Core initialized - Supabase PostgreSQL backend active")
    return cognitive_core


def get_cognitive_core() -> CognitiveCore:
    """Get the cognitive core instance."""
    if cognitive_core is None:
        raise RuntimeError("Cognitive core not initialized - call init_cognitive_core() first")
    return cognitive_core
