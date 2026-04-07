import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthResult {
  ok: boolean;
  user?: { id: string; email?: string; role: string };
  error?: string;
  status?: number;
  // Backward-compatible aliases used by existing functions.
  userId?: string | null;
  isServiceRole?: boolean;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

export async function verifyAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, error: "Missing Authorization header", status: 401, userId: null, isServiceRole: false };
  }
  const token = authHeader.substring(7).trim();
  if (!token) {
    return { ok: false, error: "Empty Bearer token", status: 401, userId: null, isServiceRole: false };
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return { ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", status: 500, userId: null, isServiceRole: false };
  }

  // Path 1: service_role key (backend workers, cron jobs)
  if (token === SERVICE_ROLE_KEY) {
    return {
      ok: true,
      user: { id: "service_role", role: "service_role" },
      status: 200,
      userId: null,
      isServiceRole: true,
    };
  }

  // Path 2: user JWT
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user) {
      return { ok: false, error: "Invalid token", status: 403, userId: null, isServiceRole: false };
    }
    return {
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email || undefined,
        role: "authenticated",
      },
      status: 200,
      userId: data.user.id,
      isServiceRole: false,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Auth error: ${message}`, status: 500, userId: null, isServiceRole: false };
  }
}

export function enforceUserOwnership(
  auth: AuthResult,
  requestedUserId: string,
): { ok: boolean; error?: string; status?: number } {
  if (!auth.ok || !auth.user) {
    return { ok: false, error: "Not authenticated", status: 401 };
  }
  if (auth.user.role === "service_role" || auth.isServiceRole) return { ok: true };
  const authUserId = auth.user.id || auth.userId;
  if (authUserId !== requestedUserId) {
    return { ok: false, error: "user_id does not match authenticated user", status: 403 };
  }
  return { ok: true };
}
