import React, { useState } from 'react';
import { Pencil } from 'lucide-react';

const CHARCOAL = 'var(--ink-display, #EDF1F7)';
const MUTED = 'var(--ink-secondary, #8FA0B8)';
const GOLD = '#E85D00';
const CARD_BG = 'var(--surface, #0E1628)';
const CARD_BORDER = 'rgba(140,170,210,0.15)';
const SERIF = "var(--font-heading)";

const WOW_CATEGORIES = ['Profile', 'Market', 'Product', 'Team', 'Strategy'];

// SMB-friendly field labels
const SMB_LABELS = {
  business_name: 'Your Business',
  what_you_do: 'What You Do',
  who_you_serve: 'Who You Serve',
  what_sets_you_apart: 'What Sets You Apart',
  biggest_challenges: 'Biggest Challenges',
  growth_opportunity: 'Growth Opportunity',
  business_overview: 'What You Do',
  industry_position: 'Market Position',
  competitive_advantages: 'What Sets You Apart',
  target_market: 'Who You Serve',
  key_challenges: 'Challenges',
};

const SparkleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ display: 'inline', verticalAlign: 'middle' }}>
    <path d="M8 0L9.8 6.2L16 8L9.8 9.8L8 16L6.2 9.8L0 8L6.2 6.2L8 0Z" fill={GOLD} />
  </svg>
);

const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ display: 'inline', verticalAlign: 'middle' }}>
    <path d="M8 1L2 4V7.5C2 11.1 4.5 14.4 8 15.5C11.5 14.4 14 11.1 14 7.5V4L8 1Z" fill="#2D6A4F" />
    <path d="M6.5 10.5L4.5 8.5L5.2 7.8L6.5 9.1L10.8 4.8L11.5 5.5L6.5 10.5Z" fill="white" />
  </svg>
);

const WowField = ({ fieldKey, label, value, editingKey, editValue, setEditValue, startEdit, commitEdit, editedFields }) => {
  const isEditing = editingKey === fieldKey;
  const isUserEdited = editedFields[fieldKey] !== undefined;
  const displayVal = typeof value === 'object' ? (value.summary || value.description || JSON.stringify(value)) : String(value);

  return (
    <div
      className="rounded-xl px-5 py-4 transition-all duration-300 group"
      style={{ background: CARD_BG, border: `1px solid ${isEditing ? GOLD : CARD_BORDER}`, cursor: isEditing ? 'text' : 'pointer' }}
      onClick={() => !isEditing && startEdit(fieldKey, displayVal)}
      data-testid={`wow-field-${fieldKey}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-medium uppercase tracking-wider" style={{ color: GOLD, letterSpacing: '0.12em' }}>{label}</h4>
          {isUserEdited ? <ShieldIcon /> : <SparkleIcon />}
        </div>
        {!isEditing && (
          <Pencil className="w-3.5 h-3.5 opacity-30 group-hover:opacity-100 transition-opacity" style={{ color: MUTED }} />
        )}
      </div>
      {isEditing ? (
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => commitEdit(fieldKey)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(fieldKey); } }}
          className="w-full text-sm leading-relaxed focus:outline-none resize-none bg-transparent"
          style={{ color: CHARCOAL, fontFamily: 'inherit', minHeight: 60 }}
          autoFocus
          rows={3}
        />
      ) : (
        <p
          className="text-sm leading-relaxed"
          style={{ color: CHARCOAL }}
        >
          {displayVal}
        </p>
      )}
      {!isEditing && (
        <span className="text-[10px] mt-2 block opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: MUTED }}>
          Click to edit
        </span>
      )}
    </div>
  );
};

const WowSummary = ({
  firstName, wowSummary, editedFields, editingKey, editValue, setEditValue,
  startEdit, commitEdit, handleConfirmWow, isSubmitting, error,
}) => {
  const renderWowFields = () => {
    if (!wowSummary) return null;
    if (typeof wowSummary === 'string') {
      return <WowField fieldKey="summary" label="About Your Business" value={wowSummary}
        editingKey={editingKey} editValue={editValue} setEditValue={setEditValue}
        startEdit={startEdit} commitEdit={commitEdit} editedFields={editedFields} />;
    }
    // Render all non-empty fields with SMB-friendly labels
    return Object.entries(wowSummary)
      .filter(([, v]) => v && typeof v === 'string' && v.trim().length > 0)
      .map(([key, val]) => (
        <WowField key={key} fieldKey={key}
          label={SMB_LABELS[key] || key.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())}
          value={val}
          editingKey={editingKey} editValue={editValue} setEditValue={setEditValue}
          startEdit={startEdit} commitEdit={commitEdit} editedFields={editedFields} />
      ));
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8" style={{ animation: 'fadeIn 0.6s ease' }}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl mb-3" style={{ fontFamily: SERIF, color: CHARCOAL, fontWeight: 600 }}>
            Your Executive Audit Brief
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: MUTED, maxWidth: 440, margin: '0 auto' }}>
            {firstName ? `${firstName}, I` : 'I'} have mapped your digital footprint to your Business DNA.
            Click any field to refine it.
          </p>
          <div className="flex items-center justify-center gap-4 mt-3">
            <span className="flex items-center gap-1 text-[11px]" style={{ color: MUTED }}><SparkleIcon /> AI-generated</span>
            <span className="flex items-center gap-1 text-[11px]" style={{ color: MUTED }}><ShieldIcon /> Verified by you</span>
          </div>
        </div>
        <div className="space-y-4" data-testid="wow-categories">{renderWowFields()}</div>
        <div className="text-center pt-6">
          <p className="text-sm mb-6" style={{ color: MUTED }}>
            Is this the foundation we should use for your intelligence memos?
          </p>
          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
          <button
            onClick={handleConfirmWow} disabled={isSubmitting}
            className="px-8 py-3.5 rounded-full text-sm font-medium transition-all disabled:opacity-40 hover:brightness-110"
            style={{ background: '#E85D00', color: '#FFFFFF' }}
            data-testid="confirm-wow-btn"
          >{isSubmitting ? 'Confirming...' : 'Confirm & Continue'}</button>
        </div>
      </div>
    </div>
  );
};

const DissolveTransition = ({ firstName }) => (
  <div className="flex-1 flex items-center justify-center px-6" style={{ animation: 'fadeIn 0.8s ease' }}>
    <div className="max-w-md text-center">
      <p className="text-lg leading-relaxed" style={{ fontFamily: SERIF, color: CHARCOAL }}>
        Thank you, {firstName || 'there'}. With your foundation verified, I now need to understand how you navigate high-stakes decisions.
      </p>
      <div className="mt-6">
        <span className="text-xs" style={{ color: '#E85D00', fontFamily: "'JetBrains Mono', monospace" }}>confirming...</span>
      </div>
    </div>
  </div>
);

export { WowSummary, DissolveTransition, SparkleIcon, ShieldIcon };
