"""
Per-User Cognitive Core - SUPABASE VERSION
========================
Maintains a continuously evolving, non-resetting cognitive profile for each user.
This profile persists across sessions, conversations, agents, and time.

MIGRATED TO: Supabase PostgreSQL (from MongoDB)
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
        """Initialize with Supabase client instead of MongoDB"""
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
