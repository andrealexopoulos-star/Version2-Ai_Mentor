// ═══════════════════════════════════════════════════════════════
// CFO CASH ANALYSIS — Supabase Edge Function
// File: supabase/functions/cfo-cash-analysis/index.ts
//
// Deploy: supabase functions deploy cfo-cash-analysis
// ═══════════════════════════════════════════════════════════════
//
// SECRETS REQUIRED:
//   OPENAI_API_KEY
//   MERGE_API_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// PURPOSE:
//   CFO Agent — Analyses financial data from connected accounting tools
//   (Xero, QuickBooks via Merge.dev) to detect:
//   - Cash flow anomalies
//   - Overdue invoices
//   - Expense spikes
//   - Revenue trend changes
//   Generates intelligence_actions for financial findings.
//
// TRIGGERS:
//   - Supabase pg_cron (weekly)
//   - Manual: POST /functions/v1/cfo-cash-analysis { "user_id": "..." }
//   - Batch:  POST /functions/v1/cfo-cash-analysis { "batch": true }
// ═══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const MERGE_API_KEY = Deno.env.get("MERGE_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FinancialAlert {
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  suggested_action: string;
  amount?: number;
  currency?: string;
}

// ─── Merge.dev API Helpers ───

async function fetchMergeData(accountToken: string, endpoint: string): Promise<any[]> {
  if (!MERGE_API_KEY || !accountToken) return [];

  try {
    const res = await fetch(`https://api.merge.dev/api/accounting/v1/${endpoint}`, {
      headers: {
        "Authorization": `Bearer ${MERGE_API_KEY}`,
        "X-Account-Token": accountToken,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

async function getInvoices(accountToken: string): Promise<any[]> {
  return fetchMergeData(accountToken, "invoices?page_size=100&status=OPEN");
}

async function getPayments(accountToken: string): Promise<any[]> {
  return fetchMergeData(accountToken, "payments?page_size=50");
}

async function getBalanceSheets(accountToken: string): Promise<any[]> {
  return fetchMergeData(accountToken, "balance-sheets?page_size=5");
}

async function getIncomeStatements(accountToken: string): Promise<any[]> {
  return fetchMergeData(accountToken, "income-statements?page_size=5");
}

// ─── Analysis Engine ───

async function analyseFinancials(
  businessName: string,
  invoices: any[],
  payments: any[],
  balanceSheets: any[],
  incomeStatements: any[],
): Promise<FinancialAlert[]> {
  // Prepare summary for OpenAI
  const overdueInvoices = invoices.filter((inv: any) => {
    if (!inv.due_date) return false;
    return new Date(inv.due_date) < new Date();
  });

  const totalOutstanding = invoices.reduce((sum: number, inv: any) => {
    return sum + (parseFloat(inv.total_amount) || 0);
  }, 0);

  const totalOverdue = overdueInvoices.reduce((sum: number, inv: any) => {
    return sum + (parseFloat(inv.total_amount) || 0);
  }, 0);

  const financialSummary = `
Business: ${businessName}
Open Invoices: ${invoices.length} (Total: $${totalOutstanding.toFixed(2)})
Overdue Invoices: ${overdueInvoices.length} (Total: $${totalOverdue.toFixed(2)})
Recent Payments: ${payments.length}
${balanceSheets.length > 0 ? `Latest Balance Sheet: ${JSON.stringify(balanceSheets[0]).substring(0, 500)}` : "No balance sheet data"}
${incomeStatements.length > 0 ? `Latest P&L: ${JSON.stringify(incomeStatements[0]).substring(0, 500)}` : "No income statement data"}

Top 5 overdue invoices:
${overdueInvoices.slice(0, 5).map((inv: any) => `- ${inv.contact?.name || "Unknown"}: $${inv.total_amount} due ${inv.due_date}`).join("\n")}
  `.trim();

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.3",
        messages: [
          {
            role: "system",
            content: `You are a CFO Agent for Australian SMBs. Analyse the financial data and identify actionable alerts.
Return JSON: {"alerts":[{"type":"overdue_invoice|cash_flow_risk|expense_spike|revenue_decline|payment_pattern","severity":"high|medium|low","title":"short title","detail":"1-2 sentence explanation","suggested_action":"specific action to take","amount":number_if_applicable}]}
Only flag material issues. No alerts = empty array. Be specific with dollar amounts. Australian context.`,
          },
          { role: "user", content: financialSummary },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const usage = data.usage || {};

    // Track OpenAI usage
    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await sb.from("usage_tracking").insert({
        function_name: "cfo-cash-analysis",
        api_provider: "openai",
        model: "gpt-5.3",
        tokens_in: usage.prompt_tokens || 0,
        tokens_out: usage.completion_tokens || 0,
        cost_estimate: ((usage.prompt_tokens || 0) * 0.00015 + (usage.completion_tokens || 0) * 0.0006) / 1000,
        called_at: new Date().toISOString(),
      });
    } catch {}

    const parsed = JSON.parse(content);
    return parsed.alerts || [];
  } catch {
    // Fallback: generate alerts from raw data without AI
    const alerts: FinancialAlert[] = [];

    if (overdueInvoices.length > 0) {
      alerts.push({
        type: "overdue_invoice",
        severity: totalOverdue > 10000 ? "high" : "medium",
        title: `${overdueInvoices.length} overdue invoice(s) totalling $${totalOverdue.toFixed(0)}`,
        detail: `You have ${overdueInvoices.length} invoices past their due date. The oldest is from ${overdueInvoices[0]?.contact?.name || "a client"}.`,
        suggested_action: "Send payment reminders for overdue invoices. Consider follow-up calls for amounts over $5,000.",
        amount: totalOverdue,
      });
    }

    return alerts;
  }
}

// ─── Main Handler ───

async function analyseUser(sb: any, userId: string): Promise<{ alerts: number; actions: number }> {
  // Get Merge.dev account token for this user
  const { data: integration } = await sb
    .from("integration_accounts")
    .select("account_token, provider")
    .eq("user_id", userId)
    .in("provider", ["xero", "quickbooks", "myob"])
    .maybeSingle();

  if (!integration?.account_token) {
    return { alerts: 0, actions: 0 };
  }

  // Load business profile
  const { data: profile } = await sb
    .from("business_profiles")
    .select("business_name")
    .eq("user_id", userId)
    .maybeSingle();

  const businessName = profile?.business_name || "Your Business";

  // Fetch financial data from Merge.dev
  const [invoices, payments, balanceSheets, incomeStatements] = await Promise.all([
    getInvoices(integration.account_token),
    getPayments(integration.account_token),
    getBalanceSheets(integration.account_token),
    getIncomeStatements(integration.account_token),
  ]);

  // Analyse
  const alerts = await analyseFinancials(businessName, invoices, payments, balanceSheets, incomeStatements);

  // Persist alerts as intelligence actions
  let actionsCreated = 0;
  for (const alert of alerts) {
    const { error } = await sb.from("intelligence_actions").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      source: "cfo_agent",
      source_id: `cfo_${alert.type}_${Date.now()}`,
      domain: "finance",
      severity: alert.severity,
      title: alert.title,
      description: alert.detail,
      suggested_action: alert.suggested_action,
      status: "action_required",
      metadata: alert.amount ? { amount: alert.amount, currency: alert.currency || "AUD" } : undefined,
      created_at: new Date().toISOString(),
    });

    if (!error) actionsCreated++;
  }

  // Update last analysis timestamp
  await sb.from("business_profiles").update({
    cfo_analysis_last: new Date().toISOString(),
  }).eq("user_id", userId);

  return { alerts: alerts.length, actions: actionsCreated };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));

    // Batch mode (for pg_cron)
    if (body.batch) {
      const { data: users } = await sb
        .from("integration_accounts")
        .select("user_id")
        .in("provider", ["xero", "quickbooks", "myob"]);

      const uniqueUsers = [...new Set((users || []).map((u: any) => u.user_id))];
      let totalAlerts = 0;
      let totalActions = 0;

      for (const userId of uniqueUsers) {
        try {
          const result = await analyseUser(sb, userId);
          totalAlerts += result.alerts;
          totalActions += result.actions;
        } catch (err) {
          console.error(`[cfo] Failed for user ${userId}: ${err}`);
        }
      }

      return new Response(JSON.stringify({
        ok: true,
        mode: "batch",
        users_analysed: uniqueUsers.length,
        total_alerts: totalAlerts,
        total_actions: totalActions,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Single user mode
    let userId = body.user_id;
    if (!userId) {
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await sb.auth.getUser(token);
      if (!user) {
        return new Response(JSON.stringify({ error: "user_id required or authenticate" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    const result = await analyseUser(sb, userId);
    return new Response(JSON.stringify({ ok: true, mode: "single", ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
