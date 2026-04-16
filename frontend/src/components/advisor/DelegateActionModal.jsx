import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Loader2, UserRoundPlus, X } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';

const DEFAULT_FORM = {
  providerPreference: 'auto',
  assigneeName: '',
  assigneeEmail: '',
  assigneeRemoteId: '',
  dueAt: '',
  collectionRemoteId: '',
  createCalendarEvent: false,
};

export const DelegateActionModal = ({
  open,
  decision,
  providers = [],
  providerOptions,
  optionsLoading,
  submitting,
  defaultCreateCalendarEvent = false,
  onClose,
  onProviderChange,
  onSubmit,
}) => {
  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    if (!open || !decision) return;

    const providerIds = providers.map((item) => item.id);
    const recommended = providerOptions?.recommendedProvider || 'auto';
    const safeProvider = providerIds.includes(recommended) ? recommended : 'auto';

    setForm({
      ...DEFAULT_FORM,
      providerPreference: safeProvider,
      createCalendarEvent: defaultCreateCalendarEvent,
    });
  }, [open, decision, providerOptions?.recommendedProvider, providers, defaultCreateCalendarEvent]);

  const assigneeOptions = useMemo(() => providerOptions?.assignees || [], [providerOptions]);
  const collectionOptions = useMemo(() => providerOptions?.collections || [], [providerOptions]);

  if (!open || !decision) return null;

  const submit = (event) => {
    event.preventDefault();
    onSubmit(form);
  };

  const onSelectAssignee = (id) => {
    const selected = assigneeOptions.find((item) => item.id === id);
    setForm((prev) => ({
      ...prev,
      assigneeRemoteId: id,
      assigneeName: selected?.name || prev.assigneeName,
      assigneeEmail: selected?.email || prev.assigneeEmail,
    }));
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 px-4"
      data-testid="delegate-action-modal-overlay"
    >
      <div
        className="w-full max-w-2xl rounded-2xl border p-5"
        style={{ background: 'var(--biqc-bg-card)', borderColor: 'var(--biqc-border)' }}
        data-testid="delegate-action-modal"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} data-testid="delegate-modal-kicker">
              Delegate workflow execution
            </p>
            <h3 className="text-xl" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="delegate-modal-title">
              {decision.signal?.title || 'Delegate decision'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="inline-flex min-h-[40px] items-center rounded-xl border px-3"
            style={{ borderColor: '#334155', color: 'var(--ink-secondary, #525252)' }}
            data-testid="delegate-modal-close-button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4" data-testid="delegate-modal-form">
          <div>
            <label className="mb-1 block text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>
              Delegate through
            </label>
            <select
              value={form.providerPreference}
              onChange={(event) => {
                const value = event.target.value;
                setForm((prev) => ({ ...prev, providerPreference: value }));
                onProviderChange(value);
              }}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ background: 'var(--surface-sunken, #F5F5F5)', borderColor: '#334155', color: 'var(--ink, #171717)' }}
              data-testid="delegate-modal-provider-select"
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id} disabled={!provider.available}>
                  {provider.label}{!provider.available ? ' (not connected)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>
                Team member
              </label>
              <input
                value={form.assigneeName}
                onChange={(event) => setForm((prev) => ({ ...prev, assigneeName: event.target.value }))}
                placeholder="Name"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                style={{ background: 'var(--surface-sunken, #F5F5F5)', borderColor: '#334155', color: 'var(--ink, #171717)' }}
                data-testid="delegate-modal-assignee-name-input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>
                Email
              </label>
              <input
                value={form.assigneeEmail}
                onChange={(event) => setForm((prev) => ({ ...prev, assigneeEmail: event.target.value }))}
                placeholder="name@company.com"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                style={{ background: 'var(--surface-sunken, #F5F5F5)', borderColor: '#334155', color: 'var(--ink, #171717)' }}
                data-testid="delegate-modal-assignee-email-input"
              />
            </div>
          </div>

          {assigneeOptions.length > 0 && (
            <div>
              <label className="mb-1 block text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>
                Select connected assignee
              </label>
              <select
                value={form.assigneeRemoteId}
                onChange={(event) => onSelectAssignee(event.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
                style={{ background: 'var(--surface-sunken, #F5F5F5)', borderColor: '#334155', color: 'var(--ink, #171717)' }}
                data-testid="delegate-modal-assignee-select"
              >
                <option value="">Select from connected users</option>
                {assigneeOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}{item.email ? ` (${item.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {collectionOptions.length > 0 && (
            <div>
              <label className="mb-1 block text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>
                Project / Board
              </label>
              <select
                value={form.collectionRemoteId}
                onChange={(event) => setForm((prev) => ({ ...prev, collectionRemoteId: event.target.value }))}
                className="w-full rounded-xl border px-3 py-2 text-sm"
                style={{ background: 'var(--surface-sunken, #F5F5F5)', borderColor: '#334155', color: 'var(--ink, #171717)' }}
                data-testid="delegate-modal-collection-select"
              >
                <option value="">Default workspace/project</option>
                {collectionOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>
                Due date and time
              </label>
              <input
                type="datetime-local"
                value={form.dueAt}
                onChange={(event) => setForm((prev) => ({ ...prev, dueAt: event.target.value }))}
                className="w-full rounded-xl border px-3 py-2 text-sm"
                style={{ background: 'var(--surface-sunken, #F5F5F5)', borderColor: '#334155', color: 'var(--ink, #171717)' }}
                data-testid="delegate-modal-due-at-input"
              />
            </div>
            <label
              className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
              style={{ background: 'var(--surface-sunken, #F5F5F5)', borderColor: '#334155', color: 'var(--ink, #171717)' }}
              data-testid="delegate-modal-calendar-toggle"
            >
              <input
                type="checkbox"
                checked={form.createCalendarEvent}
                onChange={(event) => setForm((prev) => ({ ...prev, createCalendarEvent: event.target.checked }))}
                data-testid="delegate-modal-calendar-checkbox"
              />
              <CalendarDays className="h-4 w-4" />
              Also create calendar event
            </label>
          </div>

          <div className="flex justify-between gap-2">
            <p className="text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} data-testid="delegate-modal-provider-context">
              {optionsLoading ? 'Loading provider context...' : `Provider context: ${providerOptions?.provider || form.providerPreference}`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs"
                style={{ borderColor: '#334155', color: 'var(--ink-secondary, #525252)', fontFamily: fontFamily.mono }}
                data-testid="delegate-modal-cancel-button"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs"
                style={{ borderColor: '#3B82F660', background: '#3B82F615', color: '#93C5FD', fontFamily: fontFamily.mono }}
                data-testid="delegate-modal-submit-button"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserRoundPlus className="h-3.5 w-3.5" />}
                {submitting ? 'Delegating...' : 'Delegate now'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
