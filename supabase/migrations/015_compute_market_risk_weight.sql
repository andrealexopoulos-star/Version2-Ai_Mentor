-- compute_market_risk_weight: Deterministic risk weighting for BIQc Action Plan
-- Called by biqc-insights-cognitive Edge Function before LLM synthesis
-- Prevents pure-AI drift by anchoring risk signals in deterministic logic

CREATE OR REPLACE FUNCTION compute_market_risk_weight(
  contradiction_count INT DEFAULT 0,
  runway_months INT DEFAULT 24,
  sla_breaches INT DEFAULT 0,
  pipeline_declining BOOLEAN DEFAULT FALSE,
  competitor_pressure_rising BOOLEAN DEFAULT FALSE,
  system_state TEXT DEFAULT 'STABLE',
  velocity TEXT DEFAULT 'stable'
)
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'misalignment_boost', CASE WHEN contradiction_count > 2 THEN 15 ELSE CASE WHEN contradiction_count > 0 THEN 5 ELSE 0 END END,
    'risk_amplification', CASE WHEN runway_months < 3 THEN 'CRITICAL' WHEN runway_months < 6 THEN 'ELEVATED' WHEN runway_months < 12 THEN 'MODERATE' ELSE 'NORMAL' END,
    'operational_risk', CASE WHEN sla_breaches > 5 THEN 'CRITICAL' WHEN sla_breaches > 3 THEN 'HIGH' WHEN sla_breaches > 0 THEN 'MODERATE' ELSE 'STABLE' END,
    'urgency', CASE WHEN system_state = 'CRITICAL' THEN 'IMMEDIATE' WHEN system_state = 'DRIFT' AND velocity = 'worsening' THEN 'HIGH' WHEN system_state = 'DRIFT' THEN 'MODERATE' WHEN system_state = 'COMPRESSION' THEN 'HIGH' ELSE 'LOW' END,
    'compression_probability', CASE WHEN pipeline_declining AND competitor_pressure_rising THEN 25 WHEN pipeline_declining THEN 10 WHEN competitor_pressure_rising THEN 10 ELSE 0 END,
    'overall_risk_weight', CASE
      WHEN system_state = 'CRITICAL' THEN 90
      WHEN (system_state = 'DRIFT' AND velocity = 'worsening') OR runway_months < 6 THEN 75
      WHEN system_state = 'DRIFT' OR sla_breaches > 3 OR contradiction_count > 2 THEN 55
      WHEN system_state = 'COMPRESSION' THEN 65
      ELSE 30
    END
  );
END;
$$ LANGUAGE plpgsql;
