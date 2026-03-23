import { InlineLoading } from '../components/LoadingSystems';
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api';
import DashboardLayout from '../components/DashboardLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import {
  Zap, Search, Save, RefreshCw, X, CheckCircle, AlertCircle,
  Clock, FileText, ChevronRight, Loader2, Play, History
} from 'lucide-react';

const AGENT_COLORS = {
  ALL: '#6366f1',
  MyAdvisor: '#2563eb',
  MyIntel: '#0891b2',
  ChiefOfStrategy: '#7c3aed',
  MySoundBoard: '#10B981',
  BoardRoom: '#dc2626',
  'BIQc-02': '#d97706',
  StrategyAdvisor: '#ea580c',
  EmailAnalyst: '#4f46e5',
  BIQC: '#0d9488',
  ProfileAnalyst: '#8b5cf6',
  ProfileBuilder: '#6d28d9',
  EliteMentor: '#b91c1c',
  OAC: '#15803d',
  SOPGenerator: '#0369a1',
};

export default function PromptLab() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVersion, setEditVersion] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState({});
  const [testResults, setTestResults] = useState({});
  const [activeTab, setActiveTab] = useState('prompts');
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchPrompts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/admin/prompts');
      setPrompts(res.data.prompts || []);
    } catch (err) {
      toast.error('Failed to load prompts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrompts(); }, [fetchPrompts]);

  const openEditor = async (promptKey) => {
    try {
      const res = await apiClient.get(`/admin/prompts/${promptKey}`);
      const p = res.data.prompt;
      setSelectedPrompt(p);
      setEditContent(p.content || '');
      setEditDescription(p.agent_identity || '');
      setEditVersion(p.version || '1.0');
    } catch {
      toast.error('Failed to load prompt detail');
    }
  };

  const savePrompt = async () => {
    if (!selectedPrompt) return;
    setSaving(true);
    try {
      await apiClient.put(`/admin/prompts/${selectedPrompt.prompt_key}`, {
        content: editContent,
        version: editVersion,
      });
      await apiClient.post('/admin/prompts/invalidate', {
        prompt_key: selectedPrompt.prompt_key,
      });
      toast.success(`Prompt "${selectedPrompt.prompt_key}" saved and cache invalidated`);
      setSelectedPrompt(null);
      fetchPrompts();
    } catch (err) {
      toast.error('Failed to save prompt');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (promptKey) => {
    setTesting(prev => ({ ...prev, [promptKey]: true }));
    try {
      const res = await apiClient.post(`/admin/prompts/${promptKey}/test`);
      setTestResults(prev => ({ ...prev, [promptKey]: res.data }));
      if (res.data.loaded) {
        toast.success(`"${promptKey}" loaded (${res.data.content_length} chars, cached: ${res.data.cached})`);
      } else {
        toast.error(`"${promptKey}" NOT loaded from DB`);
      }
    } catch {
      setTestResults(prev => ({ ...prev, [promptKey]: { loaded: false, error: true } }));
      toast.error(`Test failed for "${promptKey}"`);
    } finally {
      setTesting(prev => ({ ...prev, [promptKey]: false }));
    }
  };

  const invalidateAll = async () => {
    try {
      await apiClient.post('/admin/prompts/invalidate', {});
      toast.success('Full prompt cache invalidated');
      setTestResults({});
    } catch {
      toast.error('Failed to invalidate cache');
    }
  };

  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await apiClient.get('/admin/prompts/audit-log');
      setAuditLogs(res.data.logs || []);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => { if (activeTab === 'audit') fetchAuditLogs(); }, [activeTab, fetchAuditLogs]);

  const filtered = prompts.filter(p =>
    p.prompt_key?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.agent_identity?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.agent_identity?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto" data-testid="prompt-lab-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Prompt Lab
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Manage AI personalities in real-time. Changes take effect instantly.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={invalidateAll}
              variant="outline"
              className="gap-2"
              data-testid="invalidate-all-btn"
            >
              <RefreshCw className="w-4 h-4" />
              Invalidate All Caches
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-lg w-fit" style={{ background: 'var(--bg-secondary)' }}>
          {[
            { key: 'prompts', label: 'Prompts', icon: FileText },
            { key: 'audit', label: 'Audit Trail', icon: History },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all"
              style={{
                background: activeTab === tab.key ? 'var(--bg-primary)' : 'transparent',
                color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
              data-testid={`tab-${tab.key}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search - Prompts tab only */}
        {activeTab === 'prompts' && (
        <>
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <Input
            placeholder="Search by key, agent, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="prompt-search-input"
          />
        </div>

        {/* Prompt List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <InlineLoading />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p style={{ color: 'var(--text-muted)' }}>
              {searchQuery ? 'No prompts match your search' : 'No prompts found in system_prompts table'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => {
              const color = AGENT_COLORS[p.agent_identity] || '#6b7280';
              const result = testResults[p.prompt_key];
              return (
                <div
                  key={p.prompt_key}
                  className="rounded-xl p-4 flex items-center gap-4 transition-all hover:shadow-md cursor-pointer group"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                  }}
                  onClick={() => openEditor(p.prompt_key)}
                  data-testid={`prompt-row-${p.prompt_key}`}
                >
                  {/* Agent badge */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                    style={{ background: color }}
                  >
                    {p.agent_identity?.charAt(0) || '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {p.prompt_key}
                      </span>
                      <Badge variant="outline" className="text-xs" style={{ borderColor: color, color }}>
                        {p.agent_identity}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        v{p.version}
                      </Badge>
                    </div>
                    <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
                      {p.agent_identity || 'No description'}
                    </p>
                  </div>

                  {/* Test button + result */}
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {result && (
                      result.loaded ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs"
                      onClick={() => testConnection(p.prompt_key)}
                      disabled={testing[p.prompt_key]}
                      data-testid={`test-btn-${p.prompt_key}`}
                    >
                      {testing[p.prompt_key] ? (
                        <InlineLoading />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      Test
                    </Button>
                  </div>

                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }} />
                </div>
              );
            })}
          </div>
        )}
        </>
        )}

        {/* Audit Trail Tab */}
        {activeTab === 'audit' && (
          <div data-testid="audit-trail-section">
            {auditLoading ? (
              <div className="flex items-center justify-center py-20">
                <InlineLoading />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-20">
                <History className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p style={{ color: 'var(--text-muted)' }}>No audit entries yet. Changes to prompts will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log, i) => (
                  <div key={i} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">{log.prompt_key}</Badge>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>by {log.updated_by || 'system'}</span>
                      </div>
                      <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <Clock className="w-3 h-3" />
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Unknown'}
                      </span>
                    </div>
                    {log.old_content && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold mb-1" style={{ color: '#EF4444' }}>Removed:</p>
                        <pre className="text-xs p-2 rounded overflow-x-auto max-h-24" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                          {(log.old_content || '').substring(0, 200)}{log.old_content?.length > 200 ? '...' : ''}
                        </pre>
                      </div>
                    )}
                    {log.new_content && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold mb-1" style={{ color: '#10B981' }}>Added:</p>
                        <pre className="text-xs p-2 rounded overflow-x-auto max-h-24" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                          {(log.new_content || '').substring(0, 200)}{log.new_content?.length > 200 ? '...' : ''}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Editor Drawer */}
        {selectedPrompt && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-[60]"
              onClick={() => setSelectedPrompt(null)}
            />
            <div
              className="fixed right-0 top-0 h-full w-full sm:w-[640px] lg:w-[780px] z-[70] flex flex-col shadow-2xl"
              style={{ background: 'var(--bg-primary)' }}
              data-testid="prompt-editor-drawer"
            >
              {/* Drawer header */}
              <div
                className="flex items-center justify-between p-4 border-b flex-shrink-0"
                style={{ borderColor: 'var(--border-light)' }}
              >
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    {selectedPrompt.prompt_key}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge style={{ background: AGENT_COLORS[selectedPrompt.agent_identity] || '#6b7280', color: '#fff' }}>
                      {selectedPrompt.agent_identity}
                    </Badge>
                    {selectedPrompt.updated_at && (
                      <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <Clock className="w-3 h-3" />
                        {new Date(selectedPrompt.updated_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPrompt(null)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Drawer body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Description */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                    Description
                  </label>
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Prompt description..."
                    data-testid="prompt-description-input"
                  />
                </div>

                {/* Version */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                    Version
                  </label>
                  <Input
                    value={editVersion}
                    onChange={(e) => setEditVersion(e.target.value)}
                    placeholder="e.g. 1.1"
                    className="w-32"
                    data-testid="prompt-version-input"
                  />
                </div>

                {/* Content editor */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Prompt Content
                    </label>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {editContent.length.toLocaleString()} chars
                    </span>
                  </div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full rounded-lg p-4 font-mono text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-light)',
                      minHeight: '400px',
                    }}
                    spellCheck={false}
                    data-testid="prompt-content-editor"
                  />
                </div>

                {/* Dynamic variables info */}
                {selectedPrompt.dynamic_variables && selectedPrompt.dynamic_variables.length > 0 && (
                  <div className="rounded-lg p-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Dynamic Variables</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedPrompt.dynamic_variables.map((v, i) => (
                        <code key={i} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-primary)', color: 'var(--accent-primary)' }}>
                          {v}
                        </code>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer footer */}
              <div
                className="flex items-center justify-between p-4 border-t flex-shrink-0"
                style={{ borderColor: 'var(--border-light)' }}
              >
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => testConnection(selectedPrompt.prompt_key)}
                  disabled={testing[selectedPrompt.prompt_key]}
                  data-testid="prompt-test-btn"
                >
                  {testing[selectedPrompt.prompt_key] ? (
                    <InlineLoading />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Test Connection
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => setSelectedPrompt(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={savePrompt}
                    disabled={saving}
                    className="gap-2"
                    data-testid="prompt-save-btn"
                  >
                    {saving ? <InlineLoading /> : <Save className="w-4 h-4" />}
                    Save & Deploy
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
