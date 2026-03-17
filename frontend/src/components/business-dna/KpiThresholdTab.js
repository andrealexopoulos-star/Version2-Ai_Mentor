import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal, Save, Loader2, Search, ShieldCheck } from 'lucide-react';
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
    plan_label: 'Free',
    plan_tier: 'free',
    visible_metric_limit: 10,
    catalog_total_metrics: 100,
    custom_thresholds_active: 0,
    metrics: [],
  });

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/brain/kpis');
      const payload = response?.data || {};
      setConfig({
        plan_label: payload.plan_label || 'Free',
        plan_tier: payload.plan_tier || 'free',
        visible_metric_limit: payload.visible_metric_limit || 10,
        catalog_total_metrics: payload.catalog_total_metrics || 100,
        custom_thresholds_active: payload.custom_thresholds_active || 0,
        metrics: Array.isArray(payload.metrics) ? payload.metrics.map(normalizeMetric) : [],
      });
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not load KPI configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const filteredMetrics = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return config.metrics;
    return config.metrics.filter((metric) => `${metric.metric_name} ${metric.metric_key} ${metric.category}`.toLowerCase().includes(query));
  }, [config.metrics, search]);

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
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const thresholds = config.metrics.map((metric) => ({
        metric_key: metric.metric_key,
        enabled: Boolean(metric.threshold_config.enabled),
        comparator: metric.threshold_config.comparator || 'below',
        warning_value: metric.threshold_config.warning_value === '' ? null : Number(metric.threshold_config.warning_value),
        critical_value: metric.threshold_config.critical_value === '' ? null : Number(metric.threshold_config.critical_value),
        note: metric.threshold_config.note || '',
      }));
      const response = await apiClient.put('/brain/kpis', { thresholds });
      const payload = response?.data || {};
      setConfig({
        plan_label: payload.plan_label || config.plan_label,
        plan_tier: payload.plan_tier || config.plan_tier,
        visible_metric_limit: payload.visible_metric_limit || config.visible_metric_limit,
        catalog_total_metrics: payload.catalog_total_metrics || config.catalog_total_metrics,
        custom_thresholds_active: payload.custom_thresholds_active || 0,
        metrics: Array.isArray(payload.metrics) ? payload.metrics.map(normalizeMetric) : config.metrics,
      });
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
              <SlidersHorizontal className="h-4 w-4 text-[#FF6A00]" /> KPI Thresholds
            </CardTitle>
            <CardDescription data-testid="business-dna-kpi-description">
              Your plan exposes {config.visible_metric_limit} of {config.catalog_total_metrics} KPIs. Threshold changes are read on the next Brain refresh.
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
            <p className="text-xs uppercase tracking-[0.14em] text-[#94A3B8]">Plan Access</p>
            <p className="mt-2 text-xl" data-testid="business-dna-kpi-plan-label">{config.plan_label}</p>
            <p className="mt-1 text-sm text-[#94A3B8]" data-testid="business-dna-kpi-plan-limit">{config.visible_metric_limit} visible KPIs</p>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="business-dna-kpi-threshold-count-card">
            <p className="text-xs uppercase tracking-[0.14em] text-[#94A3B8]">Thresholds Active</p>
            <p className="mt-2 text-xl" data-testid="business-dna-kpi-threshold-count">{config.custom_thresholds_active}</p>
            <p className="mt-1 text-sm text-[#94A3B8]">Live Brain policy overrides</p>
          </div>
          <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(16,185,129,0.28)', background: 'rgba(16,185,129,0.08)' }} data-testid="business-dna-kpi-live-note-card">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#A7F3D0]"><ShieldCheck className="h-4 w-4" /> Live Update Behavior</p>
            <p className="mt-2 text-sm text-[#D1FAE5]" data-testid="business-dna-kpi-live-note">
              Saved thresholds apply on the next Brain refresh. If a KPI has no live computed value yet, the threshold stays stored and activates automatically once data is available.
            </p>
          </div>
        </div>

        <div className="relative" data-testid="business-dna-kpi-search-wrapper">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search KPI name, key, or category"
            className="pl-9"
            data-testid="business-dna-kpi-search-input"
          />
        </div>

        {loading ? (
          <div className="rounded-2xl border p-6 text-sm text-[#94A3B8]" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="business-dna-kpi-loading-state">
            Loading KPI policy...
          </div>
        ) : (
          <div className="space-y-3" data-testid="business-dna-kpi-metric-list">
            {filteredMetrics.map((metric) => (
              <div key={metric.metric_key} className="rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid={`business-dna-kpi-row-${metric.metric_key}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-2xl">
                    <p className="text-sm font-medium" data-testid={`business-dna-kpi-name-${metric.metric_key}`}>{metric.metric_name}</p>
                    <p className="mt-1 text-xs text-[#94A3B8]" data-testid={`business-dna-kpi-meta-${metric.metric_key}`}>{metric.category} · {metric.primary_source}</p>
                    <p className="mt-2 text-sm text-[#CBD5E1]" data-testid={`business-dna-kpi-description-${metric.metric_key}`}>{metric.description}</p>
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

                <div className="mt-4 grid gap-4 md:grid-cols-4">
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

            {!filteredMetrics.length && (
              <div className="rounded-2xl border p-6 text-sm text-[#94A3B8]" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="business-dna-kpi-empty-state">
                No KPIs matched your search.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};