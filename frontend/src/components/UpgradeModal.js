import { useNavigate } from 'react-router-dom';
import { Lock, X, Check } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';

const PLANS = {
  free: { name: 'Free', price: '$0', period: '/mo', features: ['Advisor & Morning Brief', 'Alert Centre (5 alerts)', 'Calendar & Email Triage', 'Soundboard AI Chat', 'Market Snapshot'] },
  starter: { name: 'Starter', price: '$49', period: '/mo', features: ['Everything in Free', 'Revenue Intelligence', 'Operations Dashboard', 'Marketing Intelligence', 'BoardRoom AI', 'Reports & SOP Generator', 'Billing Management'] },
  pro: { name: 'Pro', price: '$149', period: '/mo', features: ['Everything in Starter', 'Watchtower Real-Time', 'WarRoom Crisis Centre', 'Intel Centre & Risk', 'Compliance & Audit', 'Market Analysis Deep', 'Operator Dashboard', 'CMO Report'] },
};

const UpgradeModal = ({ isOpen, onClose, featureName = 'this feature', requiredTier = 'starter', currentTier = 'free' }) => {
  const navigate = useNavigate();
  if (!isOpen) return null;

  const current = PLANS[currentTier] || PLANS.free;
  const required = PLANS[requiredTier] || PLANS.starter;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', zIndex: 1000, animation: 'fadeIn 300ms ease both' }} onClick={onClose}>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes modalUp{from{opacity:0;transform:translateY(24px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>

      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', width: '90%', maxWidth: 520, overflow: 'hidden', animation: 'modalUp 400ms cubic-bezier(0.2, 0.8, 0.2, 1) both', animationDelay: '100ms', position: 'relative' }}>

        {/* Close button */}
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', color: '#708499', background: 'none', border: 'none', cursor: 'pointer' }}>
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div style={{ padding: '24px 24px 16px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(232,93,0,0.08)', border: '1px solid rgba(232,93,0,0.15)', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: 28 }}>
            <Lock className="w-7 h-7" style={{ color: '#E85D00' }} />
          </div>
          <h2 style={{ fontFamily: fontFamily?.display, fontSize: 22, color: '#EDF1F7', letterSpacing: '-0.01em', marginBottom: 8 }}>Unlock {featureName}</h2>
          <p style={{ fontSize: 14, color: '#8FA0B8', lineHeight: 1.5, maxWidth: 400, margin: '0 auto' }}>
            This feature requires a {required.name} plan or higher. Upgrade to access {featureName} and more.
          </p>
        </div>

        {/* Plan comparison */}
        <div style={{ padding: '0 24px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
            {/* Current plan */}
            <div style={{ border: '1px solid rgba(140,170,210,0.12)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#EDF1F7', marginBottom: 4 }}>{current.name}</div>
              <div style={{ fontFamily: fontFamily?.display, fontSize: 28, color: '#EDF1F7', letterSpacing: '-0.02em', marginBottom: 4 }}>{current.price}</div>
              <div style={{ fontSize: 12, color: '#708499', marginBottom: 12 }}>{current.period}</div>
              <ul style={{ textAlign: 'left', listStyle: 'none', padding: 0, margin: 0 }}>
                {current.features.map((f, i) => (
                  <li key={i} style={{ fontSize: 12, color: '#8FA0B8', padding: '3px 0', display: 'flex', alignItems: 'center', gap: 8, lineHeight: 1.4 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#10B981', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Check className="w-2 h-2 text-white" />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Required plan (recommended) */}
            <div style={{ border: '1px solid #E85D00', borderRadius: 12, padding: 16, textAlign: 'center', background: 'linear-gradient(180deg, rgba(232,93,0,0.08) 0%, var(--surface, #0E1628) 100%)', boxShadow: '0 4px 16px rgba(232,93,0,0.12)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', padding: '2px 12px', background: '#E85D00', color: 'white', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', borderRadius: 999, whiteSpace: 'nowrap' }}>RECOMMENDED</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#EDF1F7', marginBottom: 4 }}>{required.name}</div>
              <div style={{ fontFamily: fontFamily?.display, fontSize: 28, color: '#EDF1F7', letterSpacing: '-0.02em', marginBottom: 4 }}>{required.price}</div>
              <div style={{ fontSize: 12, color: '#708499', marginBottom: 12 }}>{required.period}</div>
              <ul style={{ textAlign: 'left', listStyle: 'none', padding: 0, margin: 0 }}>
                {required.features.map((f, i) => (
                  <li key={i} style={{ fontSize: 12, color: f.toLowerCase().includes(featureName.toLowerCase()) ? '#E85D00' : '#8FA0B8', padding: '3px 0', display: 'flex', alignItems: 'center', gap: 8, lineHeight: 1.4, fontWeight: f.toLowerCase().includes(featureName.toLowerCase()) ? 500 : 400 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: f.toLowerCase().includes(featureName.toLowerCase()) ? '#E85D00' : '#10B981', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Check className="w-2 h-2 text-white" />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => { onClose(); navigate('/subscribe'); }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 20px', background: '#E85D00', color: 'white', borderRadius: 8, fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer' }}>
            Upgrade to {required.name}
          </button>
          <button onClick={onClose} style={{ width: '100%', padding: '10px 20px', background: 'transparent', color: '#708499', borderRadius: 8, fontSize: 13, border: 'none', cursor: 'pointer' }}>
            Maybe later
          </button>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#708499', lineHeight: 1.4 }}>
            Cancel anytime. No long-term commitment required.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
