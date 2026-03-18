import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api';

/**
 * usePlatformData — Fetches live data from Merge.dev integrations (Xero, HubSpot, Email)
 * and Supabase intelligence snapshots. Falls back to demo data if APIs fail.
 */
export function usePlatformData() {
  const [data, setData] = useState({
    deals: null,
    contacts: null,
    companies: null,
    connected: null,
    dataReadiness: null,
    watchtower: null,
    snapshot: null,
    loading: true,
    error: null,
  });

  const fetchAll = useCallback(async () => {
    const results = {};
    const fetchers = [
      ['deals', '/integrations/crm/deals'],
      ['contacts', '/integrations/crm/contacts'],
      ['companies', '/integrations/crm/companies'],
      ['connected', '/integrations/merge/connected'],
      ['dataReadiness', '/intelligence/data-readiness'],
      ['watchtower', '/intelligence/watchtower'],
      ['snapshot', '/snapshot/latest'],
    ];

    await Promise.allSettled(
      fetchers.map(async ([key, url]) => {
        try {
          const res = await apiClient.get(url);
          results[key] = res.data;
        } catch {
          results[key] = null;
        }
      })
    );

    setData(prev => ({ ...prev, ...results, loading: false }));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { ...data, refresh: fetchAll };
}

/**
 * Extracts revenue metrics from CRM deals data
 */
export function extractRevenueMetrics(deals) {
  if (!deals?.results?.length) return null;
  const items = deals.results;
  const totalPipeline = items.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  const activeDeals = items.filter(d => d.status === 'OPEN' || !d.status?.includes('LOST')).length;
  const wonDeals = items.filter(d => d.status === 'WON').length;
  const stalled = items.filter(d => {
    if (!d.last_modified_at) return false;
    const daysSince = (Date.now() - new Date(d.last_modified_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 7 && d.status === 'OPEN';
  }).length;
  const winRate = items.length > 0 ? Math.round((wonDeals / items.length) * 100) : 0;

  // Revenue concentration
  const dealsByCompany = {};
  items.forEach(d => {
    const co = d.company?.name || d.account?.name || 'Unknown';
    dealsByCompany[co] = (dealsByCompany[co] || 0) + (parseFloat(d.amount) || 0);
  });
  const sorted = Object.entries(dealsByCompany).sort((a, b) => b[1] - a[1]);
  const topClientPct = totalPipeline > 0 && sorted.length > 0 ? Math.round((sorted[0][1] / totalPipeline) * 100) : 0;

  return {
    totalPipeline, activeDeals, wonDeals, stalled, winRate, topClientPct,
    dealCount: items.length,
    topClient: sorted[0]?.[0] || 'N/A',
    byStage: items.reduce((acc, d) => { const s = d.stage?.name || 'Unknown'; acc[s] = (acc[s] || 0) + 1; return acc; }, {}),
  };
}

/**
 * Extracts contact/people metrics from CRM contacts
 */
export function extractContactMetrics(contacts) {
  if (!contacts?.results?.length) return null;
  const items = contacts.results;
  const total = items.length;
  const recent = items.filter(c => {
    if (!c.created_at) return false;
    return (Date.now() - new Date(c.created_at).getTime()) < 30 * 24 * 60 * 60 * 1000;
  }).length;

  return { total, recentContacts: recent };
}

/**
 * Extracts integration health from connected integrations
 */
export function extractIntegrationHealth(connected) {
  if (!connected?.integrations) return null;
  const integrations = connected.integrations;
  const booleanOnly = Object.fromEntries(Object.entries(integrations).filter(([, value]) => typeof value === 'boolean'));
  const connectedCount = Object.values(booleanOnly).filter(Boolean).length;
  const names = Object.entries(booleanOnly).filter(([, v]) => v).map(([k]) => k);
  return { connectedCount, totalAvailable: Object.keys(integrations).length, names };
}
