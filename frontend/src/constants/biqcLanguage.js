/**
 * BIQC Language Constitution
 * 
 * CRITICAL: This file defines the language hierarchy for BIQC platform.
 * 
 * SYSTEM/AI outputs must use: Signal → Intelligence → Guidance
 * HUMAN services may use: Advice, Advisory, Advisor
 * 
 * This separation is required for enterprise, legal, and investor readiness.
 */

export const BIQC_LANGUAGE = {
  // For AI/System-generated outputs
  SYSTEM: {
    SIGNAL: 'BIQC Signal',
    SIGNALS: 'BIQC Signals',
    INTELLIGENCE: 'BIQC Intelligence',
    GUIDANCE: 'Guidance',
    INSIGHT: 'Intelligence Insight',
    INSIGHTS: 'Intelligence Insights'
  },
  
  // Reserved for human-delivered services only
  HUMAN: {
    ADVICE: 'Advice',
    ADVISORY: 'Advisory',
    ADVISOR: 'Advisor'
  },
  
  // Onboarding gate messaging
  ONBOARDING: {
    GATE_TITLE: 'Unlock Stronger BIQC Intelligence',
    GATE_BODY: 'BIQC learns from your business context over time. Completing onboarding strengthens the confidence and accuracy of your intelligence.',
    GATE_PRIMARY: 'Continue onboarding',
    GATE_SECONDARY: 'Skip for now',
    DEGRADED_BANNER: 'BIQC Intelligence operating with limited context',
    DEGRADED_LINK: 'Complete onboarding to strengthen learning'
  }
};

// Helper function to prevent "advice" usage in system contexts
export const validateSystemLanguage = (text) => {
  const forbidden = ['advice', 'advisor', 'advisory'];
  const lowerText = text.toLowerCase();
  
  for (const word of forbidden) {
    if (lowerText.includes(word)) {
      console.warn(`⚠️ LANGUAGE VIOLATION: "${word}" found in system text. Use Signal/Intelligence/Guidance instead.`);
      return false;
    }
  }
  
  return true;
};
