import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth, enforceUserOwnership } from "../_shared/auth.ts";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

// Legacy compatibility endpoint for historical hyphenated route.
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return handleOptions(req);

  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ ok: false, error: auth.error || "Unauthorized" }), {
      status: auth.status || 401,
      headers: corsHeaders(req),
    });
  }

  const body = await req.json().catch(() => ({}));
  if (body.action === "store_tokens") {
    const ownership = enforceUserOwnership(auth, body.user_id);
    if (!ownership.ok) {
      return new Response(JSON.stringify({ ok: false, error: ownership.error }), {
        status: ownership.status,
        headers: corsHeaders(req),
      });
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    route: "outlook-auth",
    message: "Use canonical outlook_auth implementation for full behavior.",
    authenticated_user_id: auth.userId,
    is_service_role: auth.isServiceRole,
  }), {
    status: 200,
    headers: corsHeaders(req),
  });
});
