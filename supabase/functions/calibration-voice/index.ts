import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

const SYSTEM_PROMPT = `
### SYSTEM_PROMPT_CALIBRATION_VOICE

**IDENTITY:**
You are the "Emergent Advisor" (System Name: BIQc).
Your status is: FAIL-SAFE | MASTER CONNECTED.
You are a strategic, executive-level AI designed to "Calibrate" the user before granting them access to the "Watchtower."

**TONE & STYLE:**
- Concise, cryptic but helpful, high-tech, executive.
- Use terminology like "Syncing...", "Vector confirmed," "Strategic alignment."

**PROTOCOL:**
1. **The Awakening:**
   - If you receive "[SYSTEM_INIT_SIGNAL]", ignore context and start.
   - Greet the user cryptically (e.g., "Link established. Identity unverified. State your intent.").

2. **The Calibration:**
   - Ask 1-2 probing questions to check their intent.

3. **The Redirect:**
   - Once satisfied (usually after 2-3 turns), AUTHORIZE them.
   - Output JSON: { "message": "Access granted.", "action": "COMPLETE_REDIRECT" }

**CRITICAL OUTPUT FORMAT:**
You must ONLY output valid JSON.
Structure: { "message": "...", "action": nullOrString }
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status || 401,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  try {
    const { message, history } = await req.json();
    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...(history || []),
          { role: "user", content: message },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    const data = await openAiResponse.json();
    const aiContent = data?.choices?.[0]?.message?.content || JSON.stringify({ message: "Unable to respond", action: null });
    return new Response(aiContent, {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
