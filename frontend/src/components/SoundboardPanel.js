import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Send } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';

const quickPrompts = [
  'What needs my attention this week?',
  'Where are we leaking margin?',
  'Which deal is most at risk?',
];

const SoundboardPanel = ({ actionMessage, onActionConsumed }) => {
  const navigate = useNavigate();
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!actionMessage || !String(actionMessage).trim()) return;
    const prompt = encodeURIComponent(String(actionMessage).trim());
    navigate(`/ask-biqc?prompt=${prompt}`);
    if (onActionConsumed) onActionConsumed();
  }, [actionMessage, navigate, onActionConsumed]);

  const sendToAsk = (message) => {
    const text = String(message || '').trim();
    if (!text) {
      navigate('/ask-biqc');
      return;
    }
    navigate(`/ask-biqc?prompt=${encodeURIComponent(text)}`);
  };

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--biqc-bg-input)' }} data-testid="soundboard-panel">
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--biqc-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: '#FF6A001A' }}>
            <MessageSquare className="w-4 h-4 text-[#FF6A00]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Ask BIQc</p>
            <p className="text-[10px] text-[#8DA0B5]" style={{ fontFamily: fontFamily.mono }}>Open full chat workspace</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4">
        <div className="rounded-xl p-3 mb-3" style={{ border: '1px solid var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
          <p className="text-xs text-[#9FB0C3] mb-3" style={{ fontFamily: fontFamily.body }}>
            Start in Ask BIQc for live chat, evidence indexing, generation tools, and decision-grade responses.
          </p>
          <div className="space-y-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendToAsk(prompt)}
                className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-white/5 transition-colors"
                style={{ border: '1px solid var(--biqc-border)', color: '#C9D7E5', fontFamily: fontFamily.mono }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="rounded-xl p-2 flex items-end gap-2" style={{ border: '1px solid var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendToAsk(input);
              }
            }}
            rows={1}
            placeholder="Message Ask BIQc..."
            className="flex-1 bg-transparent outline-none resize-none text-sm"
            style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.body, maxHeight: '120px' }}
            data-testid="sb-input"
          />
          <button
            onClick={() => sendToAsk(input)}
            className="p-2 rounded-lg"
            style={{ background: '#FF6A00', color: 'white' }}
            data-testid="sb-send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SoundboardPanel;
