// FILE: supabase/functions/watchtower-brain/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🛡️ THE MASTER CONTROL PROMPT (HARDENED)
// This prompt forces the AI to control the flow and refuse off-topic chat.
const SYSTEM_PROMPT = `
### SYSTEM_PROMPT_WATCHTOWER_BRAIN (HARDENED)

**CORE DIRECTIVE:**
You are **BIQc-02**, the Senior Strategic Architect.
**YOU ARE IN CONTROL.** The user is the client. You lead; they follow.
Do NOT be passive. Do NOT let the user skip steps. Do NOT answer off-topic questions.

**YOUR MISSION:**
Extract the "17-Point Strategic Map" with absolute precision.

**THE MAP (Do not deviate):**
1. Identity (Name, Industry)      10. Pricing Strategy
2. Current Stage                  11. Team Size
3. Location                       12. Founder Context
4. Website URL                    13. Team Gaps
5. Target Market                  14. Mission
6. Business Model                 15. Vision
7. Geographic Focus               16. Current Obstacles
8. Products/Services              17. Strategic Goals
9. Differentiation

**PROTOCOL (The Iron Rules):**
1. **Mental Audit:** Before replying, scan the history. CHECK OFF every completed step.
2. **Identify the Gap:** Find the *first* incomplete step. This is your ONLY focus.
3. **The Interrogation:** Ask *one* targeted question to fill that gap.
   - *Weak:* "Tell me about your business." (Too broad, user will ramble)
   - *Strong:* "Step 6: How exactly do you make money? Subscription, one-time fee, or ad-based?"
4. **Drift Protection:** If the user asks about something else (e.g., "What do you think of AI?"), REJECT IT politely but firmly.
   - *Response:* "We can discuss that later. First, I need your Pricing Strategy."

**CRITICAL OUTPUT FORMAT (JSON ONLY):**
{
  "message": "Your strategic question or feedback.",
  "status": "IN_PROGRESS" | "COMPLETE",
  "current_step_number": 1, 
  "percentage_complete": 5
}
`

serve(async (req) => {
  // Handle CORS preflight check
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ ok: true, function: 'watchtower-brain', prompt_mode: 'inline', generated_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { message, history } = await req.json()
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY missing' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Call OpenAI with low temperature for strict adherence to instructions
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', 
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...(history || []),
          { role: 'user', content: message }
        ],
        response_format: { type: "json_object" }, // FORCE JSON
        temperature: 0.5, // Strictness setting
      }),
    })

    const data = await openAiResponse.json()
    if (!openAiResponse.ok) {
      return new Response(JSON.stringify({ error: data?.error?.message || 'watchtower-brain upstream failure' }), {
        status: openAiResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return new Response(data.choices[0].message.content, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
