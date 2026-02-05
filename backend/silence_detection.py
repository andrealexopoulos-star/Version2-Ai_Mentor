"""
Silence Detection Module
Treats user silence as first-class intelligence signal
"""
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class SilenceDetector:
    """Detects and interprets user silence patterns"""
    
    def __init__(self, supabase_client):
        self.supabase = supabase_client
    
    async def detect_silence_signals(self, user_id: str) -> Dict[str, Any]:
        """
        Detect silence patterns that indicate engagement risk
        
        Returns:
            {
                'missed_check_ins': int,
                'days_since_last_login': int,
                'high_severity_ignored': int,
                'platform_engagement_trend': 'declining' | 'stable' | 'increasing',
                'silence_risk_level': 'low' | 'medium' | 'high'
            }
        """
        signals = {
            'missed_check_ins': 0,
            'days_since_last_login': 0,
            'high_severity_ignored': 0,
            'platform_engagement_trend': 'unknown',
            'silence_risk_level': 'low'
        }
        
        try:
            cadence = self.supabase.table("progress_cadence").select("*").eq("user_id", user_id).execute()
            
            if cadence.data and len(cadence.data) > 0:
                last_check_in = cadence.data[0].get('last_check_in_at')
                next_check_in = cadence.data[0].get('next_check_in_date')
                
                if next_check_in:
                    next_dt = datetime.fromisoformat(next_check_in.replace('Z', '+00:00'))
                    now = datetime.now(timezone.utc)
                    
                    if now > next_dt:
                        days_overdue = (now - next_dt).days
                        signals['missed_check_ins'] = max(1, days_overdue // 7)
            
            events = self.supabase.table("watchtower_events").select("*").eq("user_id", user_id).eq("status", "active").execute()
            
            if events.data:
                high_severity_count = len([e for e in events.data if e.get('severity') in ['critical', 'high']])
                signals['high_severity_ignored'] = high_severity_count
            
            risk_score = signals['missed_check_ins'] * 2 + signals['high_severity_ignored']
            
            if risk_score >= 5:
                signals['silence_risk_level'] = 'high'
            elif risk_score >= 2:
                signals['silence_risk_level'] = 'medium'
            else:
                signals['silence_risk_level'] = 'low'
            
            return signals
            
        except Exception as e:
            logger.error(f"Silence detection error: {e}")
            return signals
