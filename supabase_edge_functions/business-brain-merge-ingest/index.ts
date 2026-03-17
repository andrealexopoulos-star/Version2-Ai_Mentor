import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

type JsonMap = Record<string, unknown>;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MERGE_API_BASE = "https://api.merge.dev/api";

const FIELD_MAP: Record<string, Record<string, string[]>> = {
  companies: {
    external_id: ["id", "remote_id"],
    name: ["name", "legal_name"],
    industry: ["industry", "industry_type"],
    size: ["employee_count", "size"],
  },
  contacts: {
    external_id: ["id", "remote_id"],
    name: ["name", "full_name"],
    email: ["email", "email_address"],
    phone: ["phone", "phone_number"],
    status: ["status"],
  },
  owners: {
    external_id: ["id", "remote_id"],
    name: ["name", "full_name"],
    email: ["email", "email_address"],
    role: ["role", "title"],
  },
  deals: {
    external_id: ["id", "remote_id"],
    stage: ["stage", "stage_name"],
    status: ["status"],
    amount: ["amount", "value"],
    currency: ["currency", "currency_code"],
    open_date: ["created_at", "open_date"],
    close_date: ["close_date", "expected_close_date"],
    last_activity_at: ["modified_at", "last_activity_at"],
  },
  invoices: {
    external_id: ["id", "remote_id"],
    issue_date: ["issue_date"],
    due_date: ["due_date"],
    status: ["status"],
    amount: ["total_amount", "amount"],
    currency: ["currency", "currency_code"],
    paid_at: ["paid_on", "paid_at"],
    invoice_type: ["type", "invoice_type", "document_type"],
  },
  payments: {
    external_id: ["id", "remote_id"],
    payment_date: ["payment_date", "paid_at"],
    method: ["payment_method", "method"],
    amount: ["amount"],
    currency: ["currency", "currency_code"],
  },
  activities: {
    external_id: ["id", "remote_id"],
    type: ["activity_type", "type"],
    subject: ["subject", "title"],
    body: ["body", "content", "description"],
    activity_date: ["occurred_at", "activity_date", "created_at"],
  },
};

function firstValue(obj: JsonMap, paths: string[], fallback: unknown = null): unknown {
  for (const path of paths) {
    const parts = path.split(".");
    let current: unknown = obj;
    for (const p of parts) {
      if (current && typeof current === "object" && p in (current as JsonMap)) {
        current = (current as JsonMap)[p];
      } else {
        current = undefined;
        break;
      }
    }
    if (current !== undefined && current !== null && `${current}`.trim() !== "") {
      return current;
    }
  }
  return fallback;
}

async function mergeRequest(
  mergeApiKey: string,
  accountToken: string,
  endpoint: string,
  params: Record<string, string> = {},
  retries = 3,
): Promise<JsonMap> {
  const query = new URLSearchParams(params).toString();
  const url = `${MERGE_API_BASE}${endpoint}${query ? `?${query}` : ""}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${mergeApiKey}`,
        "X-Account-Token": accountToken,
        "Content-Type": "application/json",
      },
    });

    if (resp.status === 429 && attempt < retries) {
      const waitMs = (attempt + 1) * 1000;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Merge request failed (${resp.status}) ${endpoint}: ${body.slice(0, 300)}`);
    }

    return (await resp.json()) as JsonMap;
  }

  throw new Error(`Merge request retry exhausted for ${endpoint}`);
}

async function fetchPaged(
  mergeApiKey: string,
  accountToken: string,
  endpoint: string,
  modifiedAfter?: string,
  maxPages = 10,
): Promise<JsonMap[]> {
  let cursor: string | undefined;
  const all: JsonMap[] = [];

  for (let i = 0; i < maxPages; i++) {
    const params: Record<string, string> = { page_size: "100" };
    if (cursor) params.cursor = cursor;
    if (modifiedAfter) params.modified_after = modifiedAfter;

    const payload = await mergeRequest(mergeApiKey, accountToken, endpoint, params);
    const rows = (payload.results as JsonMap[]) || [];
    all.push(...rows);

    const next = payload.next as string | undefined;
    if (!next || rows.length === 0) break;
    cursor = next;
  }

  return all;
}

function normalizeCurrency(value: unknown): string {
  const s = `${value || "AUD"}`.toUpperCase().trim();
  return s.length === 3 ? s : "AUD";
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null;
  const s = `${value}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeAmount(value: unknown): number {
  const n = Number(value || 0);
  if (Number.isNaN(n)) return 0;
  return Number(n.toFixed(2));
}

async function upsertRows(
  sb: ReturnType<typeof createClient>,
  table: string,
  rows: JsonMap[],
  onConflict: string,
) {
  if (!rows.length) return;
  const { error } = await sb.schema("business_core").from(table).upsert(rows, { onConflict });
  if (error) {
    throw new Error(`Failed upsert ${table}: ${error.message}`);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const mergeApiKey = Deno.env.get("MERGE_API_KEY");

    if (!supabaseUrl || !serviceRole || !mergeApiKey) {
      throw new Error("Missing required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MERGE_API_KEY");
    }

    const sb = createClient(supabaseUrl, serviceRole);
    const body = (await req.json().catch(() => ({}))) as JsonMap;
    const tenantId = (body.tenant_id as string | undefined) || null;
    const dryRun = Boolean(body.dry_run);

    let accountsQuery = sb.from("integration_accounts").select("id,user_id,provider,category,account_token,created_at");
    if (tenantId) {
      accountsQuery = accountsQuery.eq("user_id", tenantId);
    }
    const accountsResp = await accountsQuery;
    if (accountsResp.error) throw new Error(accountsResp.error.message);

    const accounts = (accountsResp.data || []).filter((r) => ["crm", "accounting", "marketing"].includes((r.category || "").toLowerCase()));

    const summaries: JsonMap[] = [];
    for (const account of accounts) {
      const tenant = account.user_id as string;
      const connectorType = `${account.category}:${(account.provider || "merge").toString().toLowerCase()}`;

      const latestRunResp = await sb
        .schema("business_core")
        .from("source_runs")
        .select("ingested_at")
        .eq("tenant_id", tenant)
        .eq("connector_type", connectorType)
        .eq("status", "completed")
        .order("ingested_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const modifiedAfter = latestRunResp.data?.ingested_at || undefined;

      const sourceRun = {
        tenant_id: tenant,
        connector_type: connectorType,
        connector_account_id: `${account.id}`,
        status: "started",
        run_meta: { provider: account.provider, category: account.category, modified_after: modifiedAfter || null },
      };

      const runInsert = await sb.schema("business_core").from("source_runs").insert(sourceRun).select("source_id").single();
      if (runInsert.error) throw new Error(runInsert.error.message);
      const sourceId = runInsert.data.source_id as string;

      try {
        const accountToken = account.account_token as string;

        const [companies, contacts, owners, deals, invoices, payments, activities, leads, campaigns] = await Promise.all([
          fetchPaged(mergeApiKey, accountToken, "/crm/v1/accounts", modifiedAfter),
          fetchPaged(mergeApiKey, accountToken, "/crm/v1/contacts", modifiedAfter),
          fetchPaged(mergeApiKey, accountToken, "/crm/v1/users", modifiedAfter),
          fetchPaged(mergeApiKey, accountToken, "/crm/v1/opportunities", modifiedAfter),
          fetchPaged(mergeApiKey, accountToken, "/accounting/v1/invoices", modifiedAfter),
          fetchPaged(mergeApiKey, accountToken, "/accounting/v1/payments", modifiedAfter),
          fetchPaged(mergeApiKey, accountToken, "/crm/v1/engagements", modifiedAfter),
          fetchPaged(mergeApiKey, accountToken, "/crm/v1/leads", modifiedAfter).catch(() => []),
          fetchPaged(mergeApiKey, accountToken, "/marketing/v1/campaigns", modifiedAfter).catch(() => []),
        ]);

        const companyRows = companies.map((c) => {
          const externalId = `${connectorType}:company:${firstValue(c, FIELD_MAP.companies.external_id, crypto.randomUUID())}`;
          return {
            tenant_id: tenant,
            source_id: sourceId,
            source_primary_external_id: externalId,
            external_ids: { [connectorType]: firstValue(c, FIELD_MAP.companies.external_id, null) },
            name: `${firstValue(c, FIELD_MAP.companies.name, "Unknown Company")}`,
            industry: `${firstValue(c, FIELD_MAP.companies.industry, "")}` || null,
            size: `${firstValue(c, FIELD_MAP.companies.size, "")}` || null,
            deleted_at: c.deleted_at ? normalizeDate(c.deleted_at) : null,
          };
        });

        const ownerRows = owners.map((o) => {
          const externalId = `${connectorType}:owner:${firstValue(o, FIELD_MAP.owners.external_id, crypto.randomUUID())}`;
          return {
            tenant_id: tenant,
            source_id: sourceId,
            source_primary_external_id: externalId,
            external_ids: { [connectorType]: firstValue(o, FIELD_MAP.owners.external_id, null) },
            name: `${firstValue(o, FIELD_MAP.owners.name, "Unknown Owner")}`,
            email: `${firstValue(o, FIELD_MAP.owners.email, "")}` || null,
            role: `${firstValue(o, FIELD_MAP.owners.role, "")}` || null,
            active: true,
          };
        });

        const customerRows = contacts.map((c) => {
          const email = `${firstValue(c, ["email_addresses.0.email_address", ...FIELD_MAP.contacts.email], "")}`.toLowerCase().trim();
          const name = `${firstValue(c, FIELD_MAP.contacts.name, "Unknown Contact")}`;
          const dedupeKey = email ? `email:${email}` : `name:${name.toLowerCase()}`;
          const externalId = `${connectorType}:customer:${dedupeKey}`;
          return {
            tenant_id: tenant,
            source_id: sourceId,
            source_primary_external_id: externalId,
            external_ids: { [connectorType]: firstValue(c, FIELD_MAP.contacts.external_id, null) },
            name,
            email: email || null,
            phone: `${firstValue(c, ["phone_numbers.0.phone_number", ...FIELD_MAP.contacts.phone], "")}` || null,
            status: `${firstValue(c, FIELD_MAP.contacts.status, "active")}`,
          };
        });

        const dealRows = deals.map((d) => {
          const externalId = `${connectorType}:deal:${firstValue(d, FIELD_MAP.deals.external_id, crypto.randomUUID())}`;
          return {
            tenant_id: tenant,
            source_id: sourceId,
            source_primary_external_id: externalId,
            external_ids: { [connectorType]: firstValue(d, FIELD_MAP.deals.external_id, null) },
            stage: `${firstValue(d, FIELD_MAP.deals.stage, "unknown")}`,
            status: `${firstValue(d, FIELD_MAP.deals.status, "open")}`,
            amount: normalizeAmount(firstValue(d, FIELD_MAP.deals.amount, 0)),
            currency: normalizeCurrency(firstValue(d, FIELD_MAP.deals.currency, "AUD")),
            open_date: normalizeDate(firstValue(d, FIELD_MAP.deals.open_date, null)),
            close_date: normalizeDate(firstValue(d, FIELD_MAP.deals.close_date, null)),
            last_activity_at: normalizeDate(firstValue(d, FIELD_MAP.deals.last_activity_at, null)),
          };
        });

        const invoiceRows = invoices.map((inv) => {
          const externalId = `${connectorType}:invoice:${firstValue(inv, FIELD_MAP.invoices.external_id, crypto.randomUUID())}`;
          return {
            tenant_id: tenant,
            source_id: sourceId,
            source_primary_external_id: externalId,
            external_ids: { [connectorType]: firstValue(inv, FIELD_MAP.invoices.external_id, null) },
            issue_date: normalizeDate(firstValue(inv, FIELD_MAP.invoices.issue_date, null)),
            due_date: normalizeDate(firstValue(inv, FIELD_MAP.invoices.due_date, null)),
            status: `${firstValue(inv, FIELD_MAP.invoices.status, "unknown")}`,
            invoice_type: `${firstValue(inv, FIELD_MAP.invoices.invoice_type, "accounts_receivable")}`,
            amount: normalizeAmount(firstValue(inv, FIELD_MAP.invoices.amount, 0)),
            currency: normalizeCurrency(firstValue(inv, FIELD_MAP.invoices.currency, "AUD")),
            paid_at: normalizeDate(firstValue(inv, FIELD_MAP.invoices.paid_at, null)),
            deleted_at: inv.deleted_at ? normalizeDate(inv.deleted_at) : null,
          };
        });

        const paymentRows = payments.map((p) => {
          const externalId = `${connectorType}:payment:${firstValue(p, FIELD_MAP.payments.external_id, crypto.randomUUID())}`;
          return {
            tenant_id: tenant,
            source_id: sourceId,
            source_primary_external_id: externalId,
            external_ids: { [connectorType]: firstValue(p, FIELD_MAP.payments.external_id, null) },
            payment_date: normalizeDate(firstValue(p, FIELD_MAP.payments.payment_date, null)),
            method: `${firstValue(p, FIELD_MAP.payments.method, "")}` || null,
            amount: normalizeAmount(firstValue(p, FIELD_MAP.payments.amount, 0)),
            currency: normalizeCurrency(firstValue(p, FIELD_MAP.payments.currency, "AUD")),
          };
        });

        const activityRows = activities.map((a) => {
          const externalId = `${connectorType}:activity:${firstValue(a, FIELD_MAP.activities.external_id, crypto.randomUUID())}`;
          return {
            tenant_id: tenant,
            source_id: sourceId,
            source_primary_external_id: externalId,
            external_ids: { [connectorType]: firstValue(a, FIELD_MAP.activities.external_id, null) },
            type: `${firstValue(a, FIELD_MAP.activities.type, "unknown")}`,
            subject: `${firstValue(a, FIELD_MAP.activities.subject, "")}` || null,
            body: `${firstValue(a, FIELD_MAP.activities.body, "")}` || null,
            activity_date: normalizeDate(firstValue(a, FIELD_MAP.activities.activity_date, null)),
          };
        });

        if (!dryRun) {
          await upsertRows(sb, "companies", companyRows, "tenant_id,source_primary_external_id");
          await upsertRows(sb, "owners", ownerRows, "tenant_id,source_primary_external_id");
          await upsertRows(sb, "customers", customerRows, "tenant_id,source_primary_external_id");
          await upsertRows(sb, "deals", dealRows, "tenant_id,source_primary_external_id");
          await upsertRows(sb, "invoices", invoiceRows, "tenant_id,source_primary_external_id");
          await upsertRows(sb, "payments", paymentRows, "tenant_id,source_primary_external_id");
          await upsertRows(sb, "activities", activityRows, "tenant_id,source_primary_external_id");

          await sb.from("ic_intelligence_events").insert({
            tenant_id: tenant,
            event_type: "OBJECT_UPDATED",
            model_name: "business_brain_merge_ingestion",
            json_payload: {
              connector_type: connectorType,
              source_id: sourceId,
              counts: {
                companies: companyRows.length,
                contacts: customerRows.length,
                owners: ownerRows.length,
                deals: dealRows.length,
                invoices: invoiceRows.length,
                payments: paymentRows.length,
                activities: activityRows.length,
                leads: leads.length,
                campaigns: campaigns.length,
              },
            },
            confidence_score: 0.92,
          });
        }

        await sb.schema("business_core").from("source_runs").update({
          status: "completed",
          ingested_at: new Date().toISOString(),
          run_meta: {
            provider: account.provider,
            category: account.category,
            modified_after: modifiedAfter || null,
            dry_run: dryRun,
            counts: {
              companies: companyRows.length,
              contacts: customerRows.length,
              owners: ownerRows.length,
              deals: dealRows.length,
              invoices: invoiceRows.length,
              payments: paymentRows.length,
              activities: activityRows.length,
              leads: leads.length,
              campaigns: campaigns.length,
            },
          },
        }).eq("source_id", sourceId);

        summaries.push({
          tenant_id: tenant,
          connector_type: connectorType,
          source_id: sourceId,
          status: "completed",
          counts: {
            companies: companyRows.length,
            contacts: customerRows.length,
            owners: ownerRows.length,
            deals: dealRows.length,
            invoices: invoiceRows.length,
            payments: paymentRows.length,
            activities: activityRows.length,
            leads: leads.length,
            campaigns: campaigns.length,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown ingestion error";
        await sb.schema("business_core").from("source_runs").update({
          status: "failed",
          error_message: message,
          ingested_at: new Date().toISOString(),
        }).eq("source_id", sourceId);

        summaries.push({
          tenant_id: tenant,
          connector_type: connectorType,
          source_id: sourceId,
          status: "failed",
          error: message,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, dry_run: dryRun, runs: summaries }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unhandled error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
