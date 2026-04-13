import { CognitiveMesh } from '../components/LoadingSystems';
import { useState, useRef, useCallback } from 'react';
import { apiClient } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import {
  FileText, CheckSquare, Target, Save, Copy, Check, Upload,
  Sparkles, Clock, Users, Shield, DollarSign,
  Briefcase, ClipboardList, AlertTriangle, ShoppingCart, Scale, RefreshCw,
  X
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { fontFamily } from '../design-system/tokens';
import { toast } from 'sonner';

/* No hardcoded SOPs -- grid shows generated SOPs or empty state */

const CATEGORY_TABS = [
  { key: 'all', label: 'All SOPs' },
  { key: 'sales', label: 'Sales' },
  { key: 'operations', label: 'Operations' },
  { key: 'finance', label: 'Finance' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'compliance', label: 'Compliance' },
];

/* Templates are starter suggestions, not real data */
const TEMPLATES = [
  { id: 1, title: 'Employee Onboarding', description: 'New hire onboarding checklist', icon: Users, category: 'Onboarding', isTemplate: true },
  { id: 2, title: 'Quality Assurance', description: 'Product/service quality check', icon: ClipboardList, category: 'Operations', isTemplate: true },
  { id: 3, title: 'Incident Response', description: 'Security incident handling', icon: AlertTriangle, category: 'Compliance', isTemplate: true },
  { id: 4, title: 'Procurement', description: 'Vendor selection and purchase approval', icon: ShoppingCart, category: 'Operations', isTemplate: true },
  { id: 5, title: 'Contract Review', description: 'Legal review checklist', icon: Scale, category: 'Compliance', isTemplate: true },
  { id: 6, title: 'Change Management', description: 'Organizational change process', icon: RefreshCw, category: 'Operations', isTemplate: true },
];

/* ─── Helpers ─── */
const statusConfig = {
  published:  { label: 'Published',  bg: 'rgba(34,197,94,0.12)',  color: '#22C55E' },
  draft:      { label: 'Draft',      bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' },
  in_review:  { label: 'In Review',  bg: 'rgba(59,130,246,0.12)', color: '#3B82F6' },
};

const sourceConfig = {
  ai:     { label: 'AI Generated', bg: 'rgba(232,93,0,0.12)', color: '#E85D00' },
  manual: { label: 'Manual',       bg: 'rgba(140,170,210,0.10)', color: 'var(--ink-secondary, #8FA0B8)' },
};

/* ─── SOP Card component ─── */
const SOPCard = ({ sop }) => {
  const src = sourceConfig[sop.source];
  const st = statusConfig[sop.status];

  return (
    <div
      style={{
        background: 'var(--surface, #0E1628)',
        border: '1px solid rgba(140,170,210,0.12)',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'border-color 0.2s, box-shadow 0.2s',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(140,170,210,0.25)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(140,170,210,0.12)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Badges */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: 10, fontWeight: 700, fontFamily: fontFamily.mono,
          padding: '3px 8px', borderRadius: 999,
          background: src.bg, color: src.color,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          {src.label}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, fontFamily: fontFamily.mono,
          padding: '3px 8px', borderRadius: 999,
          background: st.bg, color: st.color,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          {st.label}
        </span>
      </div>

      {/* Title */}
      <h3 style={{
        fontFamily: fontFamily.display, fontSize: 20, fontWeight: 600,
        color: 'var(--ink-display, #EDF1F7)', margin: 0, lineHeight: 1.25,
        letterSpacing: '-0.01em',
      }}>
        {sop.title}
      </h3>

      {/* Description */}
      <p style={{
        fontFamily: fontFamily.body, fontSize: 14, color: 'var(--ink-secondary, #8FA0B8)',
        margin: 0, lineHeight: 1.5,
      }}>
        {sop.description}
      </p>

      {/* Step dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono, marginRight: 4 }}>
          {sop.totalSteps} steps
        </span>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: sop.totalSteps }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: i < sop.completedSteps ? '#E85D00' : 'rgba(140,170,210,0.18)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Meta row */}
      <div style={{
        borderTop: '1px solid rgba(140,170,210,0.08)',
        paddingTop: 12, marginTop: 2,
        display: 'flex', alignItems: 'center', gap: 12,
        fontSize: 12, color: 'var(--ink-muted, #708499)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: fontFamily.body }}>
          <Clock size={14} /> {sop.updatedAgo ? `Updated ${sop.updatedAgo}` : 'Just created'}
        </span>
      </div>
    </div>
  );
};

/* ─── Template Card component ─── */
const TemplateCard = ({ template, onClick }) => {
  const Icon = template.icon;
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface, #0E1628)',
        border: '1px solid rgba(140,170,210,0.12)',
        borderRadius: 12,
        padding: 16,
        cursor: 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#E85D00';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(140,170,210,0.12)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'rgba(232,93,0,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} style={{ color: '#E85D00' }} />
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700, fontFamily: fontFamily.mono,
          padding: '2px 8px', borderRadius: 999,
          background: 'rgba(140,170,210,0.08)', color: 'var(--ink-muted, #708499)',
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          Template
        </span>
      </div>
      <h4 style={{
        fontFamily: fontFamily.body, fontSize: 14, fontWeight: 600,
        color: 'var(--ink-display, #EDF1F7)', margin: 0,
      }}>
        {template.title}
      </h4>
      <p style={{
        fontFamily: fontFamily.body, fontSize: 12, color: 'var(--ink-muted, #708499)',
        margin: 0, lineHeight: 1.5,
      }}>
        {template.description}
      </p>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   SOPGenerator — Main Component
   ═══════════════════════════════════════════════════════ */
const SOPGenerator = () => {
  /* ─── State: existing API integration ─── */
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);

  const [sopForm, setSopForm] = useState({ topic: '', business_context: '', document_id: null });
  const [checklistForm, setChecklistForm] = useState({ topic: '', context: '' });
  const [actionPlanForm, setActionPlanForm] = useState({ goal: '', timeline: '3 months', resources: '' });

  /* ─── State: new layout features ─── */
  const [activeCategory, setActiveCategory] = useState('all');
  const [sopCards, setSopCards] = useState([]);

  /* Generator form fields */
  const [genTitle, setGenTitle] = useState('');
  const [genCategory, setGenCategory] = useState('Sales');
  const [genDescription, setGenDescription] = useState('');
  const [genOwner, setGenOwner] = useState('');
  const [genFrequency, setGenFrequency] = useState('Quarterly');

  const generatorRef = useRef(null);

  /* ─── Scroll helper ─── */
  const scrollToGenerator = useCallback(() => {
    generatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  /* ─── Filtered cards ─── */
  const filteredCards = activeCategory === 'all'
    ? sopCards
    : sopCards.filter(s => s.category === activeCategory);

  /* ─── Existing API handlers (preserved) ─── */
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'SOP Reference');
      formData.append('description', 'Document for SOP generation');
      const response = await apiClient.post('/data-center/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadedFile(response.data);
      setSopForm({ ...sopForm, document_id: response.data.id });
      toast.success(`${file.name} uploaded successfully!`);
    } catch (error) {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const generateSOP = async (e) => {
    if (e) e.preventDefault();
    const topic = genTitle || sopForm.topic;
    if (!topic) {
      toast.error('Please enter a title or topic');
      return;
    }
    setLoading(true);
    setResult(null);
    setShowResultModal(true);
    try {
      const response = await apiClient.post('/generate/sop', {
        topic,
        business_context: genDescription || sopForm.business_context,
        category: genCategory,
        process_owner: genOwner,
        review_frequency: genFrequency,
        uploaded_file_id: uploadedFile?.id,
      });
      const newSop = { type: 'SOP', content: response.data.sop_content, title: topic };
      setResult(newSop);
      setSopCards(prev => [{
        id: Date.now(),
        title: topic,
        description: genDescription || 'AI-generated standard operating procedure.',
        source: 'ai',
        status: 'draft',
        totalSteps: 1,
        completedSteps: 0,
        category: (genCategory || 'Custom').toLowerCase(),
        updatedAgo: null,
      }, ...prev]);
      toast.success('SOP generated!');
    } catch (error) {
      toast.error('Generation failed');
      setShowResultModal(false);
    } finally {
      setLoading(false);
    }
  };

  const generateChecklist = async (e) => {
    if (e) e.preventDefault();
    if (!checklistForm.topic) {
      toast.error('Please enter a topic');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const response = await apiClient.post('/generate/checklist', checklistForm);
      setResult({ type: 'Checklist', content: response.data.checklist_content, title: checklistForm.topic });
      toast.success('Checklist generated!');
    } catch (error) {
      toast.error('Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const generateActionPlan = async (e) => {
    if (e) e.preventDefault();
    if (!actionPlanForm.goal) {
      toast.error('Please enter a goal');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const response = await apiClient.post('/generate/action-plan', actionPlanForm);
      setResult({ type: 'Action Plan', content: response.data.action_plan, title: actionPlanForm.goal });
      toast.success('Action plan generated!');
    } catch (error) {
      toast.error('Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const saveDocument = async () => {
    if (!result) return;
    try {
      await apiClient.post('/documents', {
        title: result.title,
        document_type: result.type,
        content: result.content,
        tags: [result.type.toLowerCase()],
      });
      toast.success('Saved to documents!');
    } catch (error) {
      toast.error('Failed to save');
    }
  };

  const saveDraft = async () => {
    if (!genTitle) {
      toast.error('Please enter a title first');
      return;
    }
    try {
      await apiClient.post('/documents', {
        title: genTitle,
        document_type: 'SOP',
        content: `**Draft SOP**\n\nCategory: ${genCategory}\nOwner: ${genOwner || 'Unassigned'}\nReview: ${genFrequency}\n\n${genDescription}`,
        tags: ['sop', 'draft'],
      });
      toast.success('Draft saved!');
    } catch (error) {
      toast.error('Failed to save draft');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result?.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard!');
  };

  const handleTemplateClick = (template) => {
    setGenTitle(template.title);
    setGenCategory(template.category || 'Custom');
    scrollToGenerator();
  };

  /* ─── Shared styles ─── */
  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    fontSize: 14,
    fontFamily: fontFamily.body,
    color: 'var(--ink-display, #EDF1F7)',
    background: '#060A12',
    border: '1px solid rgba(140,170,210,0.12)',
    borderRadius: 10,
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  const selectStyle = {
    ...inputStyle,
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23708499' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    paddingRight: 40,
  };

  const labelStyle = {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--ink-display, #EDF1F7)',
    fontFamily: fontFamily.body,
    marginBottom: 4,
    display: 'block',
  };

  const gradientBtnStyle = {
    background: 'linear-gradient(135deg, #E85D00, #FF7A18)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fontFamily.body,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    transition: 'opacity 0.2s, box-shadow 0.2s',
  };

  const ghostBtnStyle = {
    background: 'transparent',
    color: 'var(--ink-secondary, #8FA0B8)',
    border: '1px solid rgba(140,170,210,0.12)',
    borderRadius: 10,
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 500,
    fontFamily: fontFamily.body,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    transition: 'border-color 0.2s, color 0.2s',
  };

  /* ═══ RENDER ═══ */
  return (
    <DashboardLayout>
      <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }} data-testid="sop-generator-page">

        {/* ────────── 1. HEADER ────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{
            fontFamily: fontFamily.display, fontSize: 28, fontWeight: 700,
            color: 'var(--ink-display, #EDF1F7)', margin: 0, letterSpacing: '-0.02em',
          }}>
            SOP Generator
          </h1>
          <button
            onClick={scrollToGenerator}
            style={{
              ...gradientBtnStyle,
              padding: '10px 20px',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(232,93,0,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
          >
            <Sparkles size={16} /> New SOP
          </button>
        </div>

        {/* ────────── 2. CATEGORY TABS ────────── */}
        <div style={{
          borderBottom: '1px solid rgba(140,170,210,0.12)',
          marginBottom: 24,
          display: 'flex',
          gap: 4,
          overflowX: 'auto',
        }}>
          {CATEGORY_TABS.map(tab => {
            const isActive = activeCategory === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveCategory(tab.key)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #E85D00' : '2px solid transparent',
                  padding: '12px 16px',
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 500,
                  fontFamily: fontFamily.body,
                  color: isActive ? 'var(--ink-display, #EDF1F7)' : '#8FA0B8',
                  cursor: 'pointer',
                  transition: 'color 0.2s, border-color 0.2s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#c0cfe0'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--ink-secondary, #8FA0B8)'; }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ────────── 3. SOP CARD GRID ────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 20,
          marginBottom: 32,
        }}>
          {filteredCards.length > 0 ? filteredCards.map(sop => (
            <SOPCard key={sop.id} sop={sop} />
          )) : (
            <div style={{
              gridColumn: '1 / -1',
              background: 'var(--surface, #0E1628)',
              border: '1px solid rgba(140,170,210,0.12)',
              borderRadius: 16,
              padding: 48,
              textAlign: 'center',
            }}>
              <FileText size={40} style={{ color: '#64748B', margin: '0 auto 16px', display: 'block' }} />
              <h3 style={{
                fontFamily: fontFamily.display, fontSize: 18, fontWeight: 600,
                color: 'var(--ink-display, #EDF1F7)', margin: '0 0 8px',
              }}>
                No SOPs generated yet
              </h3>
              <p style={{
                fontFamily: fontFamily.body, fontSize: 13, color: '#64748B',
                maxWidth: 420, margin: '0 auto', lineHeight: 1.6,
              }}>
                Create your first SOP using the generator below.
              </p>
            </div>
          )}
        </div>

        {/* ────────── 4. GENERATOR PANEL ────────── */}
        <div
          ref={generatorRef}
          style={{
            background: 'var(--surface, #0E1628)',
            border: '1px solid rgba(140,170,210,0.12)',
            borderRadius: 16,
            padding: 24,
            marginBottom: 32,
          }}
        >
          <h2 style={{
            fontFamily: fontFamily.display, fontSize: 22, fontWeight: 600,
            color: 'var(--ink-display, #EDF1F7)', margin: '0 0 4px',
          }}>
            Generate New SOP
          </h2>
          <p style={{
            fontFamily: fontFamily.body, fontSize: 14, color: 'var(--ink-secondary, #8FA0B8)',
            margin: '0 0 20px', lineHeight: 1.5,
          }}>
            Describe the process and BIQc will generate a structured, step-by-step procedure from your business data.
          </p>

          <form onSubmit={generateSOP}>
            {/* Row 1: Title + Category */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>SOP Title</label>
                <input
                  type="text"
                  value={genTitle}
                  onChange={e => setGenTitle(e.target.value)}
                  placeholder="e.g. Weekly Pipeline Review Process"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = '#E85D00'; e.target.style.boxShadow = '0 0 0 3px rgba(232,93,0,0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(140,170,210,0.12)'; e.target.style.boxShadow = 'none'; }}
                  data-testid="sop-title-input"
                />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select
                  value={genCategory}
                  onChange={e => setGenCategory(e.target.value)}
                  style={selectStyle}
                  onFocus={e => { e.target.style.borderColor = '#E85D00'; e.target.style.boxShadow = '0 0 0 3px rgba(232,93,0,0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(140,170,210,0.12)'; e.target.style.boxShadow = 'none'; }}
                >
                  <option value="Sales">Sales</option>
                  <option value="Operations">Operations</option>
                  <option value="Finance">Finance</option>
                  <option value="Onboarding">Onboarding</option>
                  <option value="Compliance">Compliance</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
            </div>

            {/* Row 2: Description (full width) */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Describe the process</label>
              <textarea
                value={genDescription}
                onChange={e => setGenDescription(e.target.value)}
                placeholder="Describe the process you want to document. Include key steps, decision points, and who is responsible for each stage. BIQc will structure this into a formal SOP with clear ownership and escalation paths."
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                onFocus={e => { e.target.style.borderColor = '#E85D00'; e.target.style.boxShadow = '0 0 0 3px rgba(232,93,0,0.12)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(140,170,210,0.12)'; e.target.style.boxShadow = 'none'; }}
                data-testid="sop-description-input"
              />
            </div>

            {/* Row 3: Owner + Frequency */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Process Owner</label>
                <input
                  type="text"
                  value={genOwner}
                  onChange={e => setGenOwner(e.target.value)}
                  placeholder="e.g. Andreas Alexopoulos"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = '#E85D00'; e.target.style.boxShadow = '0 0 0 3px rgba(232,93,0,0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(140,170,210,0.12)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <div>
                <label style={labelStyle}>Review Frequency</label>
                <select
                  value={genFrequency}
                  onChange={e => setGenFrequency(e.target.value)}
                  style={selectStyle}
                  onFocus={e => { e.target.style.borderColor = '#E85D00'; e.target.style.boxShadow = '0 0 0 3px rgba(232,93,0,0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(140,170,210,0.12)'; e.target.style.boxShadow = 'none'; }}
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Bi-annually">Bi-annually</option>
                  <option value="Annually">Annually</option>
                </select>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  ...gradientBtnStyle,
                  opacity: loading ? 0.6 : 1,
                  pointerEvents: loading ? 'none' : 'auto',
                }}
                data-testid="generate-sop-btn"
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" />
                    </svg>
                    Generating...
                  </span>
                ) : (
                  <>
                    <Sparkles size={16} /> Generate with AI
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={saveDraft}
                style={ghostBtnStyle}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(140,170,210,0.25)'; e.currentTarget.style.color = 'var(--ink-display, #EDF1F7)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(140,170,210,0.12)'; e.currentTarget.style.color = 'var(--ink-secondary, #8FA0B8)'; }}
              >
                <Save size={16} /> Save as draft
              </button>
            </div>
          </form>
        </div>

        {/* ────────── 5. TEMPLATES SECTION ────────── */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{
            fontFamily: fontFamily.display, fontSize: 22, fontWeight: 600,
            color: 'var(--ink-display, #EDF1F7)', margin: '0 0 16px',
          }}>
            Start from a template
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}>
            {TEMPLATES.map(t => (
              <TemplateCard key={t.id} template={t} onClick={() => handleTemplateClick(t)} />
            ))}
          </div>
        </div>

      </div>

      {/* ────────── RESULT MODAL (shown after AI generation) ────────── */}
      {showResultModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 32,
          }}
          onClick={e => { if (e.target === e.currentTarget && !loading) setShowResultModal(false); }}
        >
          <div style={{
            background: 'var(--surface, #0E1628)',
            border: '1px solid rgba(140,170,210,0.12)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 720,
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          }}>
            {/* Modal header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(140,170,210,0.12)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                {result && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, fontFamily: fontFamily.body,
                    padding: '3px 10px', borderRadius: 8,
                    background: 'rgba(232,93,0,0.12)', color: '#E85D00',
                    marginRight: 10,
                  }}>
                    {result.type}
                  </span>
                )}
                <span style={{
                  fontFamily: fontFamily.display, fontSize: 18, fontWeight: 600, color: 'var(--ink-display, #EDF1F7)',
                }}>
                  {loading ? 'Generating...' : result?.title || 'Result'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {result && (
                  <>
                    <button
                      onClick={copyToClipboard}
                      style={{
                        ...ghostBtnStyle,
                        padding: '8px 14px', fontSize: 12,
                      }}
                      data-testid="copy-result-btn"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={saveDocument}
                      style={{
                        ...ghostBtnStyle,
                        padding: '8px 14px', fontSize: 12,
                      }}
                      data-testid="save-result-btn"
                    >
                      <Save size={14} /> Save
                    </button>
                  </>
                )}
                <button
                  onClick={() => { if (!loading) setShowResultModal(false); }}
                  style={{
                    background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer',
                    color: 'var(--ink-muted, #708499)', padding: 6, display: 'flex',
                    opacity: loading ? 0.4 : 1,
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
              {loading && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <CognitiveMesh compact />
                  <p style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.body, fontSize: 14, marginTop: 16 }}>
                    Generating your SOP...
                  </p>
                </div>
              )}
              {result && !loading && (
                <div
                  className="markdown-content prose prose-sm max-w-none"
                  style={{ color: '#c5d0de', fontFamily: fontFamily.body, fontSize: 14, lineHeight: 1.7 }}
                >
                  <ReactMarkdown>{result.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spin keyframe for loading */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </DashboardLayout>
  );
};

export default SOPGenerator;
