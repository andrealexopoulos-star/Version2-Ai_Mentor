import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal, Save, Loader2, Search, ShieldCheck, Sparkles, Lock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { apiClient } from '../../lib/api';
import { toast } from 'sonner';

const normalizeMetric = (metric) => ({
  ...metric,
  threshold_config: {
    enabled: Boolean(metric?.threshold_config?.enabled),
    comparator: metric?.threshold_config?.comparator || 'below',
    warning_value: metric?.threshold_config?.warning_value ?? '',
    critical_value: metric?.threshold_config?.critical_value ?? '',
    note: metric?.threshold_config?.note || '',
  },
});

export const KpiThresholdTab = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [config, setConfig] = useState({
    // 2026-04-19: no free tier. Default flash is Trial until backend payload lands.
    plan_label: 'Trial',
    plan_tier: 'trial',
    visible_metric_limit: 10,
    catalog_total_metrics: 100,
    custom_thresholds_active: 0,
    selected_metric_keys: [],
    selected_count: 0,
    selection_limit_reached: false,
    selection_upgrade_prompt: '',
    metrics: [],
    catalog_metrics: [],
  });

  const applyPayload = (payload = {}) => {
    setConfig({
      // 2026-04-19: no free tier — fall back to Trial for unpaid states.
      plan_label: payload.plan_label || 'Trial',
      plan_tier: payload.plan_tier || 'trial',
      visible_metric_limit: payload.visible_metric_limit || 10,
      catalog_total_metrics: payload.catalog_total_metrics || 100,
      custom_thresholds_active: payload.custom_thresholds_active || 0,
      selected_metric_keys: Array.isArray(payload.selected_metric_keys) ? payload.selected_metric_keys : [],
      selected_count: payload.selected_count || 0,
      selection_limit_reached: Boolean(payload.selection_limit_reached),
      selection_upgrade_prompt: payload.selection_upgrade_prompt || '',
      metrics: Array.isArray(payload.metrics) ? payload.metrics.map(normalizeMetric) : [],
      catalog_metrics: Array.isArray(payload.catalog_metrics) ? payload.catalog_metrics.map(normalizeMetric) : [],
    });
  };

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/brain/kpis');
      applyPayload(response?.data || {});
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not load KPI configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLowerCase();
    const source = config.catalog_metrics || [];
    if (!query) return source;
    return source.filter((metric) => `${metric.metric_name} ${metric.metric_key} ${metric.category}`.toLowerCase().includes(query));
  }, [config.catalog_metrics, search]);

  const selectedMetrics = useMemo(() => {
    const selected = new Set(config.selected_metric_keys || []);
    return (config.catalog_metrics || []).filter((metric) => selected.has(metric.metric_key));
  }, [config.catalog_metrics, config.selected_metric_keys]);

  const availableSlots = Math.max(0, config.visible_metric_limit - (config.selected_count || 0));

  const updateMetric = (metricKey, updater) => {
    setConfig((prev) => ({
      ...prev,
      metrics: prev.metrics.map((metric) => {
        if (metric.metric_key !== metricKey) return metric;
        return {
          ...metric,
          threshold_config: updater(metric.threshold_config),
        };
      }),
      catalog_metrics: prev.catalog_metrics.map((metric) => {
        if (metric.metric_key !== metricKey) return metric;
        return {
          ...metric,
          threshold_config: updater(metric.threshold_config),
        };
      }),
    }));
  };

  const toggleMetricSelection = (metricKey) => {
    setConfig((prev) => {
      const selected = new Set(prev.selected_metric_keys || []);
      const alreadySelected = selected.has(metricKey);
      if (!alreadySelected && selected.size >= prev.visible_metric_limit) {
        toast.info(prev.selection_upgrade_prompt || `Your current plan includes ${prev.visible_metric_limit} active KPI slots. Upgrade for more.`);
        return prev;
      }

      if (alreadySelected) selected.delete(metricKey);
      else selected.add(metricKey);

      const selectedMetricKeys = prev.catalog_metrics
        .filter((metric) => selected.has(metric.metric_key))
        .map((metric) => metric.metric_key);

      return {
        ...prev,
        selected_metric_keys: selectedMetricKeys,
        selected_count: selectedMetricKeys.length,
        selection_limit_reached: selectedMetricKeys.length >= prev.visible_metric_limit,
        metrics: prev.catalog_metrics.filter((metric) => selectedMetricKeys.includes(metric.metric_key)),
        catalog_metrics: prev.catalog_metrics.map((metric) => ({
          ...metric,
          selected: selected.has(metric.metric_key),
          selection_disabled: !selected.has(metric.metric_key) && selectedMetricKeys.length >= prev.visible_metric_limit,
        })),
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const thresholds = selectedMetrics.map((metric) => ({
        metric_key: metric.metric_key,
        enabled: Boolean(metric.threshold_config.enabled),
        comparator: metric.threshold_config.comparator || 'below',
        warning_value: metric.threshold_config.warning_value === '' ? null : Number(metric.threshold_config.warning_value),
        critical_value: metric.threshold_config.critical_value === '' ? null : Number(metric.threshold_config.critical_value),
        note: metric.threshold_config.note || '',
      }));
      const response = await apiClient.put('/brain/kpis', {
        selected_metric_keys: config.selected_metric_keys,
        thresholds,
      });
      const payload = response?.data || {};
      applyPayload(payload);
      toast.success(payload.message || 'KPI thresholds saved.');
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not save KPI thresholds.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card data-testid="business-dna-kpi-tab">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2" data-testid="business-dna-kpi-title">
              <SlidersHorizontal className="h-4 w-4 text-[#E85D00]" /> KPI Thresholds
            </CardTitle>
            <CardDescription data-testid="business-dna-kpi-description">
              Choose the KPIs BIQc should track most closely for your business. Your current plan includes {config.visible_metric_limit} active KPI slots.
            </CardDescription>
          </div>
          <Button onClick={handleSave} disabled={saving || loading} data-testid="business-dna-kpi-save-button">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save KPI Policy
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="business-dna-kpi-plan-card">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-secondary)]">Plan Access</p>
            <p className="mt-2 text-xl" data-testid="business-dna-kpi-plan-label">{config.plan_label}</p>
            <p className="mt-1 text-sm text-[var(--ink-secondary)]" data-testid="business-dna-kpi-plan-limit">{config.visible_metric_limit} visible KPIs</p>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: config.selection_limit_reached ? 'rgba(232,93,0,0.32)' : 'var(--biqc-border)', background: config.selection_limit_reached ? 'rgba(232,93,0,0.08)' : 'var(--biqc-bg-card)' }} data-testid="business-dna-kpi-selected-count-card">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-secondary)]">Selected Now</p>
            <p className="mt-2 flex items-center gap-2 text-xl" data-testid="business-dna-kpi-selected-count">
              {config.selected_count}
              <span className="text-sm text-[var(--ink-secondary)]">/ {config.visible_metric_limit}</span>
            </p>
            <p className="mt-1 text-sm text-[var(--ink-secondary)]">{availableSlots} slot{availableSlots === 1 ? '' : 's'} remaining</p>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="business-dna-kpi-threshold-count-card">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-secondary)]">Thresholds Active</p>
            <p className="mt-2 text-xl" data-testid="business-dna-kpi-threshold-count">{config.custom_thresholds_active}</p>
            <p className="mt-1 text-sm text-[var(--ink-secondary)]">Live Brain policy overrides</p>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(16,185,129,0.28)', background: 'rgba(16,185,129,0.08)' }} data-testid="business-dna-kpi-live-note-card">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#A7F3D0]"><ShieldCheck className="h-4 w-4" /> Live Update Behavior</p>
            <p className="mt-2 text-sm text-[#D1FAE5]" data-testid="business-dna-kpi-live-note">
              Saved thresholds apply on the next Brain refresh. If a KPI has no live computed value yet, the threshold stays stored and activates automatically once data is available.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: config.selection_limit_reached ? 'rgba(232,93,0,0.32)' : 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="business-dna-kpi-selection-guide">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#E85D00]" />
            <p className="text-sm text-[#E2E8F0]">
              Select the KPIs that matter most to your business right now. BIQc will use these as your active free-tier intelligence policy.
            </p>
          </div>
          {config.selection_limit_reached && config.selection_upgrade_prompt && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border px-3 py-3" style={{ borderColor: 'rgba(232,93,0,0.28)', background: 'rgba(232,93,0,0.08)' }} data-testid="business-dna-kpi-upgrade-prompt">
              <Lock className="mt-0.5 h-4 w-4 text-[#E85D00]" />
              <p className="text-sm text-[#FDEAD7]">{config.selection_upgrade_prompt}</p>
            </div>
          )}
        </div>

        <div className="relative" data-testid="business-dna-kpi-search-wrapper">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-secondary)]" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search KPI name, key, or category"
            className="pl-9"
            data-testid="business-dna-kpi-search-input"
          />
        </div>

        {loading ? (
          <div className="rounded-2xl border p-6 text-sm text-[var(--ink-secondary)]" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="business-dna-kpi-loading-state">
            Loading KPI policy...
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="space-y-3" data-testid="business-dna-kpi-catalog-list">
              {filteredCatalog.map((metric) => (
                <div key={metric.metric_key} className="rounded-2xl border p-4" style={{ borderColor: metric.selected ? 'rgba(232,93,0,0.32)' : 'var(--biqc-border)', background: metric.selected ? 'rgba(232,93,0,0.06)' : 'var(--biqc-bg-card)' }} data-testid={`business-dna-kpi-row-${metric.metric_key}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium" data-testid={`business-dna-kpi-name-${metric.metric_key}`}>{metric.metric_name}</p>
                        {metric.selected && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]" style={{ color: '#E85D00', background: 'rgba(232,93,0,0.12)', fontFamily: 'var(--font-mono)' }}><CheckCircle2 className="h-3 w-3" /> Active</span>}
                      </div>
                      <p className="mt-1 text-xs text-[var(--ink-secondary)]" data-testid={`business-dna-kpi-meta-${metric.metric_key}`}>{metric.category} · {metric.primary_source}</p>
                      <p className="mt-2 text-sm text-[#CBD5E1]" data-testid={`business-dna-kpi-description-${metric.metric_key}`}>{metric.description}</p>
                    </div>
                    <Button
                      variant={metric.selected ? 'default' : 'outline'}
                      onClick={() => toggleMetricSelection(metric.metric_key)}
                      disabled={metric.selection_disabled}
                      data-testid={`business-dna-kpi-select-${metric.metric_key}`}
                    >
                      {metric.selected ? 'Selected' : (metric.selection_disabled ? 'Limit reached' : 'Select KPI')}
                    </Button>
                  </div>
                </div>
              ))}

              {!filteredCatalog.length && (
                <div className="rounded-2xl border p-6 text-sm text-[var(--ink-secondary)]" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="business-dna-kpi-empty-state">
                  No KPIs matched your search.
                </div>
              )}
            </div>

            <div className="space-y-3" data-testid="business-dna-kpi-selected-panel">
              <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-secondary)]">Active KPI set</p>
                <p className="mt-2 text-sm text-[#CBD5E1]">These are the KPI signals BIQc will prioritise for your free-tier intelligence policy.</p>
              </div>

              {selectedMetrics.map((metric) => (
                <div key={metric.metric_key} className="rounded-2xl border p-4" style={{ borderColor: 'rgba(232,93,0,0.24)', background: 'rgba(232,93,0,0.05)' }} data-testid={`business-dna-kpi-selected-row-${metric.metric_key}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="max-w-2xl">
                      <p className="text-sm font-medium text-[#F8FAFC]">{metric.metric_name}</p>
                      <p className="mt-1 text-xs text-[var(--ink-secondary)]">{metric.category} · {metric.primary_source}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[#E2E8F0]" data-testid={`business-dna-kpi-enabled-label-${metric.metric_key}`}>
                      <input
                        type="checkbox"
                        checked={metric.threshold_config.enabled}
                        onChange={(event) => updateMetric(metric.metric_key, (current) => ({ ...current, enabled: event.target.checked }))}
                        data-testid={`business-dna-kpi-enabled-input-${metric.metric_key}`}
                      />
                      Enable threshold
                    </label>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <Label htmlFor={`comparator-${metric.metric_key}`}>Alert when value is</Label>
                      <select
                        id={`comparator-${metric.metric_key}`}
                        value={metric.threshold_config.comparator}
                        onChange={(event) => updateMetric(metric.metric_key, (current) => ({ ...current, comparator: event.target.value }))}
                        className="mt-2 flex h-10 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                        style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-input)' }}
                        data-testid={`business-dna-kpi-comparator-${metric.metric_key}`}
                      >
                        <option value="below">Below threshold</option>
                        <option value="above">Above threshold</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor={`warning-${metric.metric_key}`}>Warning threshold</Label>
                      <Input
                        id={`warning-${metric.metric_key}`}
                        type="number"
                        value={metric.threshold_config.warning_value}
                        onChange={(event) => updateMetric(metric.metric_key, (current) => ({ ...current, warning_value: event.target.value }))}
                        placeholder="Optional"
                        className="mt-2"
                        data-testid={`business-dna-kpi-warning-${metric.metric_key}`}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`critical-${metric.metric_key}`}>Critical threshold</Label>
                      <Input
                        id={`critical-${metric.metric_key}`}
                        type="number"
                        value={metric.threshold_config.critical_value}
                        onChange={(event) => updateMetric(metric.metric_key, (current) => ({ ...current, critical_value: event.target.value }))}
                        placeholder="Optional"
                        className="mt-2"
                        data-testid={`business-dna-kpi-critical-${metric.metric_key}`}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`note-${metric.metric_key}`}>Operator note</Label>
                      <Input
                        id={`note-${metric.metric_key}`}
                        value={metric.threshold_config.note}
                        onChange={(event) => updateMetric(metric.metric_key, (current) => ({ ...current, note: event.target.value }))}
                        placeholder="Optional"
                        className="mt-2"
                        data-testid={`business-dna-kpi-note-${metric.metric_key}`}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {!selectedMetrics.length && (
                <div className="rounded-2xl border p-6 text-sm text-[var(--ink-secondary)]" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="business-dna-kpi-selected-empty-state">
                  Select up to {config.visible_metric_limit} KPIs from the catalog to define your active BIQc free-tier policy.
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};