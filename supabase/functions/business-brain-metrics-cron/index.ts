import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function f(value: unknown, fallback = 0): number {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(`${value}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const sb = createClient(supabaseUrl, serviceRole);
    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenant_id as string | undefined;

    let tenantQuery = sb.schema("business_core").from("source_runs").select("tenant_id");
    if (tenantId) {
      tenantQuery = tenantQuery.eq("tenant_id", tenantId);
    }
    const tenantResp = await tenantQuery;
    if (tenantResp.error) throw new Error(tenantResp.error.message);

    const tenants = [...new Set((tenantResp.data || []).map((r) => r.tenant_id).filter(Boolean))] as string[];
    const today = new Date();
    const periodEnd = today.toISOString().slice(0, 10);
    const periodStartDate = new Date(today);
    periodStartDate.setDate(periodStartDate.getDate() - 30);
    const periodStart = periodStartDate.toISOString().slice(0, 10);

    const summaries: unknown[] = [];

    for (const tenant of tenants) {
      const [invoiceResp, dealResp, customerResp, taskResp] = await Promise.all([
        sb.schema("business_core").from("invoices").select("id,status,invoice_type,amount,due_date,paid_at").eq("tenant_id", tenant).is("deleted_at", null),
        sb.schema("business_core").from("deals").select("id,status,amount,last_activity_at,open_date,close_date").eq("tenant_id", tenant).is("deleted_at", null),
        sb.schema("business_core").from("customers").select("id,status").eq("tenant_id", tenant).is("deleted_at", null),
        sb.schema("business_core").from("tasks").select("id,status,due_date").eq("tenant_id", tenant).is("deleted_at", null),
      ]);

      if (invoiceResp.error || dealResp.error || customerResp.error || taskResp.error) {
        throw new Error(`Data fetch failed for tenant ${tenant}`);
      }

      const invoices = invoiceResp.data || [];
      const deals = dealResp.data || [];
      const customers = customerResp.data || [];
      const tasks = taskResp.data || [];

      const paidStatus = new Set(["paid", "closed_paid", "settled"]);
      const closedStatus = new Set(["paid", "void", "deleted", "cancelled", "canceled", "credited"]);
      const openInvoiceStatus = new Set(["open", "authorized", "submitted", "partially_paid", "sent", "approved", "overdue"]);

      let totalRevenue = 0;
      let overdueArAmount = 0;
      let overdueArCount = 0;

      for (const inv of invoices) {
        const status = `${inv.status || ""}`.toLowerCase();
        const type = `${inv.invoice_type || ""}`.toLowerCase();
        const amount = f(inv.amount);
        const due = parseDate(inv.due_date);
        const clientInvoice = !(type.includes("payable") || type.includes("supplier") || type.includes("vendor") || type.includes("bill") || type.includes("ap"));

        if (clientInvoice && paidStatus.has(status)) {
          totalRevenue += amount;
        }

        const isOverdue = !closedStatus.has(status) && (status === "overdue" || (openInvoiceStatus.has(status) && !!due && due < today));
        if (clientInvoice && isOverdue) {
          overdueArAmount += amount;
          overdueArCount += 1;
        }
      }

      const openDeals = deals.filter((d) => !["won", "lost", "closed"].includes(`${d.status || ""}`.toLowerCase()));
      const wonDeals = deals.filter((d) => ["won", "closed_won"].includes(`${d.status || ""}`.toLowerCase()));
      const lostDeals = deals.filter((d) => ["lost", "closed_lost"].includes(`${d.status || ""}`.toLowerCase()));

      const pipelineValue = openDeals.reduce((acc, d) => acc + f(d.amount), 0);
      const avgDealSize = openDeals.length ? pipelineValue / openDeals.length : 0;
      const totalClosed = wonDeals.length + lostDeals.length;
      const winRate = totalClosed ? wonDeals.length / totalClosed : 0;

      const cycleDays = (wonDeals.concat(lostDeals))
        .map((d) => {
          const o = parseDate(d.open_date);
          const c = parseDate(d.close_date);
          if (!o || !c) return null;
          return Math.max(0, Math.round((c.getTime() - o.getTime()) / 86400000));
        })
        .filter((n): n is number => n !== null);
      const avgSalesCycle = cycleDays.length ? cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length : 0;
      const salesVelocity = openDeals.length ? (openDeals.length * avgDealSize * winRate) / Math.max(1, avgSalesCycle) : 0;

      const churned = customers.filter((c) => ["lost", "churned"].includes(`${c.status || ""}`.toLowerCase())).length;
      const churnRate = customers.length ? churned / customers.length : 0;

      const overdueTasks = tasks.filter((t) => {
        const due = parseDate(t.due_date);
        const status = `${t.status || ""}`.toLowerCase();
        return !!due && due < today && !["done", "closed", "completed"].includes(status);
      }).length;
      const taskOverdueRate = tasks.length ? overdueTasks / tasks.length : 0;

      const metrics = [
        { metric_name: "total_revenue", metric_group: "Finance", value: totalRevenue },
        { metric_name: "pipeline_value", metric_group: "Sales", value: pipelineValue },
        { metric_name: "number_of_opportunities", metric_group: "Sales", value: openDeals.length },
        { metric_name: "average_deal_size", metric_group: "Sales", value: avgDealSize },
        { metric_name: "win_rate", metric_group: "Sales", value: winRate },
        { metric_name: "sales_velocity", metric_group: "Sales", value: salesVelocity },
        { metric_name: "overdue_ar_count", metric_group: "Liquidity", value: overdueArCount },
        { metric_name: "overdue_ar_amount", metric_group: "Liquidity", value: overdueArAmount },
        { metric_name: "churn_rate", metric_group: "Customer", value: churnRate },
        { metric_name: "task_overdue_rate", metric_group: "Operations", value: taskOverdueRate },
      ].map((m) => ({
        tenant_id: tenant,
        ...m,
        period: "daily",
        period_start: periodStart,
        period_end: periodEnd,
        calculation_details: { source: "business_brain_metrics_cron", rolling_window_days: 30 },
        evidence_ids: [],
        confidence_score: 0.85,
        calculated_at: new Date().toISOString(),
      }));

      const metricWrite = await sb
        .schema("business_core")
        .from("business_metrics")
        .upsert(metrics, { onConflict: "tenant_id,metric_name,period,period_start,period_end" });
      if (metricWrite.error) throw new Error(metricWrite.error.message);

      await sb.from("ic_daily_metric_snapshots").upsert(
        {
          tenant_id: tenant,
          snapshot_date: periodEnd,
          revenue: totalRevenue,
          deal_velocity: salesVelocity,
          risk_score: Math.min(1, overdueArAmount / Math.max(1, totalRevenue + 1)),
          active_deals: openDeals.length,
          stalled_deals: openDeals.filter((d) => {
            const last = parseDate(d.last_activity_at);
            if (!last) return false;
            return (today.getTime() - last.getTime()) / 86400000 >= 10;
          }).length,
          pipeline_value: pipelineValue,
          engagement_score: Math.max(0, 1 - taskOverdueRate),
        },
        { onConflict: "tenant_id,snapshot_date" },
      );

      await sb.from("ic_intelligence_events").insert({
        tenant_id: tenant,
        event_type: "METRIC_CHANGE",
        model_name: "business_brain_metrics_cron",
        json_payload: {
          period_start: periodStart,
          period_end: periodEnd,
          metrics_count: metrics.length,
        },
        confidence_score: 0.9,
      });

      summaries.push({ tenant_id: tenant, metrics_count: metrics.length, period_start: periodStart, period_end: periodEnd });
    }

    return new Response(JSON.stringify({ ok: true, processed_tenants: tenants.length, summaries }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unhandled metrics cron error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
