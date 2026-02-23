// ═══════════════════════════════════════════════════════════════════════════
// SUPABASE EDGE FUNCTION: Financial Data Ingestion for biqc-insights-cognitive
// ═══════════════════════════════════════════════════════════════════════════
//
// DEPLOY THIS TO YOUR SUPABASE EDGE FUNCTIONS
// This code should be added to the `biqc-insights-cognitive` edge function
// to enable financial data from ANY connected accounting provider (Xero, QuickBooks, MYOB, etc.)
//
// HOW TO USE:
// 1. In the Supabase Dashboard, go to Edge Functions
// 2. Edit the `biqc-insights-cognitive` function
// 3. Add the fetchFinancialData() function below
// 4. Call it in the main handler alongside existing CRM/email data fetching
// 5. Pass the financial data to the OpenAI prompt as additional context
//
// ═══════════════════════════════════════════════════════════════════════════

// --- ADD THIS FUNCTION to the edge function ---

async function fetchFinancialData(accountId, supabaseClient) {
  /**
   * Fetches financial data from ANY connected accounting integration via the backend API.
   * This is provider-agnostic — works with Xero, QuickBooks, MYOB, or any Merge.dev accounting integration.
   */
  try {
    // 1. Check if accounting integration is connected
    const { data: integrations } = await supabaseClient
      .from('merge_integrations')
      .select('*')
      .eq('account_id', accountId)
      .eq('category', 'accounting')
      .eq('active', true);

    if (!integrations || integrations.length === 0) {
      return { connected: false, provider: null, data: null };
    }

    const integration = integrations[0];
    const accountToken = integration.account_token;
    const provider = integration.provider || 'accounting';

    // 2. Fetch invoices from Merge.dev Unified Accounting API
    const MERGE_API_KEY = Deno.env.get('MERGE_API_KEY');
    const headers = {
      'Authorization': `Bearer ${MERGE_API_KEY}`,
      'X-Account-Token': accountToken,
      'Content-Type': 'application/json',
    };

    const [invoicesRes, paymentsRes] = await Promise.allSettled([
      fetch('https://api.merge.dev/api/accounting/v1/invoices?page_size=50', { headers }),
      fetch('https://api.merge.dev/api/accounting/v1/payments?page_size=20', { headers }),
    ]);

    let invoices = [];
    let payments = [];

    if (invoicesRes.status === 'fulfilled' && invoicesRes.value.ok) {
      const data = await invoicesRes.value.json();
      invoices = data.results || [];
    }

    if (paymentsRes.status === 'fulfilled' && paymentsRes.value.ok) {
      const data = await paymentsRes.value.json();
      payments = data.results || [];
    }

    // 3. Calculate financial metrics
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let overdueCount = 0;
    let totalPaid = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const inv of invoices) {
      const amount = parseFloat(inv.total_amount || inv.amount || 0);
      const status = (inv.status || '').toUpperCase();
      
      if (['SUBMITTED', 'AUTHORIZED', 'OPEN'].includes(status)) {
        totalOutstanding += amount;
      }
      
      if (inv.due_date && inv.due_date < today && !['PAID', 'VOIDED'].includes(status)) {
        totalOverdue += amount;
        overdueCount++;
      }
      
      if (status === 'PAID') {
        totalPaid += amount;
      }
    }

    for (const pay of payments) {
      totalPaid += parseFloat(pay.total_amount || pay.amount || 0);
    }

    return {
      connected: true,
      provider: provider,
      data: {
        invoices_count: invoices.length,
        total_outstanding: Math.round(totalOutstanding * 100) / 100,
        total_overdue: Math.round(totalOverdue * 100) / 100,
        overdue_count: overdueCount,
        total_paid_recent: Math.round(totalPaid * 100) / 100,
        recent_payments: payments.length,
        // Top 5 outstanding invoices for context
        top_outstanding: invoices
          .filter(i => !['PAID', 'VOIDED'].includes((i.status || '').toUpperCase()))
          .sort((a, b) => parseFloat(b.total_amount || 0) - parseFloat(a.total_amount || 0))
          .slice(0, 5)
          .map(i => ({
            number: i.number || i.invoice_number || 'N/A',
            amount: parseFloat(i.total_amount || i.amount || 0),
            due_date: i.due_date,
            status: i.status,
            contact: i.contact?.name || i.company?.name || 'Unknown',
          })),
      },
    };
  } catch (error) {
    console.error('Financial data fetch error:', error);
    return { connected: false, error: error.message, data: null };
  }
}


// --- ADD THIS TO THE MAIN PROMPT BUILDER ---
// In the section where you build data_sources and the OpenAI prompt,
// add financial data like this:

function buildFinancialContext(financialData) {
  if (!financialData?.connected || !financialData?.data) {
    return '';
  }

  const d = financialData.data;
  let context = `\n\n=== FINANCIAL DATA (${financialData.provider}) ===\n`;
  context += `Total invoices: ${d.invoices_count}\n`;
  context += `Outstanding: $${d.total_outstanding.toLocaleString()}\n`;
  context += `Overdue: $${d.total_overdue.toLocaleString()} (${d.overdue_count} invoices)\n`;
  context += `Recent payments received: ${d.recent_payments}\n`;

  if (d.top_outstanding?.length > 0) {
    context += `\nTop outstanding invoices:\n`;
    for (const inv of d.top_outstanding) {
      context += `- ${inv.number}: $${inv.amount.toLocaleString()} (${inv.contact}) due ${inv.due_date || 'N/A'} [${inv.status}]\n`;
    }
  }

  return context;
}


// --- INTEGRATION INSTRUCTIONS ---
// 
// In your biqc-insights-cognitive Edge Function:
//
// 1. After fetching CRM data, add:
//    const financialData = await fetchFinancialData(accountId, supabaseClient);
//
// 2. Add to data_sources array:
//    if (financialData.connected) {
//      data_sources.push(`${financialData.provider} (${financialData.data.invoices_count} invoices)`);
//    }
//
// 3. Add to the OpenAI prompt context:
//    const financialContext = buildFinancialContext(financialData);
//    // Append financialContext to your existing context string
//
// 4. The AI will now see financial data and can generate insights about:
//    - Cash flow health
//    - Overdue invoices requiring follow-up
//    - Payment trends
//    - Revenue recognition
//
// This is PROVIDER-AGNOSTIC — it works with Xero, QuickBooks, MYOB, 
// or any accounting system connected via Merge.dev.
