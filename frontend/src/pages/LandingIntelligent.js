import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Shield, Check, Clock, DollarSign, Users, Menu, X } from 'lucide-react';

/* ═══ TYPEWRITER HOOK ═══ */
const useTypewriter = (phrases, speed = 75, pause = 2200, deleteSpeed = 40) => {
  const [displayed, setDisplayed] = useState('');
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const charRef = useRef(0);

  useEffect(() => {
    const current = phrases[phraseIdx];
    const timer = setTimeout(() => {
      if (!isDeleting) {
        charRef.current = Math.min(charRef.current + 1, current.length);
        setDisplayed(current.substring(0, charRef.current));
        if (charRef.current === current.length) {
          setTimeout(() => setIsDeleting(true), pause);
        }
      } else {
        charRef.current = Math.max(charRef.current - 1, 0);
        setDisplayed(current.substring(0, charRef.current));
        if (charRef.current === 0) {
          setIsDeleting(false);
          setPhraseIdx(p => (p + 1) % phrases.length);
        }
      }
    }, isDeleting ? deleteSpeed : speed);
    return () => clearTimeout(timer);
  }, [displayed, isDeleting, phraseIdx, phrases, speed, pause, deleteSpeed]);

  return displayed;
};

/* ═══ ANIMATED ORANGE DOT ═══ */
const FlowDot = ({ path, dur, delay = 0 }) => (
  <circle r="4.5" fill="#FF6A00" style={{ filter: 'drop-shadow(0 0 5px rgba(249,115,22,0.7))' }}>
    <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`${delay}s`}>
      <mpath href={path} />
    </animateMotion>
  </circle>
);

/* ═══ CONNECTION DIAGRAM ═══ */
const ConnectionDiagram = () => {
  const [activeRow, setActiveRow] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setActiveRow(r => (r + 1) % 5), 1800);
    return () => clearInterval(t);
  }, []);

  const integrations = [
    { label: 'CRM', color: '#FF6A00', items: ['H', 'S', 'P'], colors: ['#FF6A00','#00A1E0','#4B0082'] },
    { label: 'Financial', color: '#FF6A00', items: ['X', 'Q', 'S'], colors: ['#13B5EA','#2CA01C','#635BFF'] },
    { label: 'Email', color: '#3B82F6', items: ['O', 'G'], colors: ['#D83B01','#4285F4'] },
    { label: 'Comms', color: '#7C3AED', items: ['Sl', 'T'], colors: ['#4A154B','#6264A7'] },
    { label: 'HR + More', color: '#10B981', items: ['B', 'W', '+'], colors: ['#73C41D','#FF4500','#94A3B8'] },
  ];

  return (
    <div className="relative w-full max-w-5xl mx-auto" style={{ height: 440 }}>
      {/* SVG lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 900 440" preserveAspectRatio="xMidYMid meet">
        <defs>
          <path id="dp-left" d="M 175 220 C 280 220 340 220 395 220" />
          <path id="dp-r0" d="M 505 220 C 580 220 620 90 710 90" />
          <path id="dp-r1" d="M 505 220 C 580 220 620 158 710 158" />
          <path id="dp-r2" d="M 505 220 C 580 220 620 220 710 220" />
          <path id="dp-r3" d="M 505 220 C 580 220 620 282 710 282" />
          <path id="dp-r4" d="M 505 220 C 580 220 620 350 710 350" />
        </defs>

        {/* Left line */}
        <path d="M 175 220 C 280 220 340 220 395 220" stroke="rgba(180,195,215,0.5)" strokeWidth="1.5" fill="none" strokeDasharray="6 4"/>
        {/* Right lines */}
        {[0,1,2,3,4].map(i => (
          <path key={i}
            d={[
              "M 505 220 C 580 220 620 90 710 90",
              "M 505 220 C 580 220 620 158 710 158",
              "M 505 220 C 580 220 620 220 710 220",
              "M 505 220 C 580 220 620 282 710 282",
              "M 505 220 C 580 220 620 350 710 350",
            ][i]}
            stroke={activeRow === i ? 'rgba(249,115,22,0.6)' : 'rgba(180,195,215,0.35)'}
            strokeWidth={activeRow === i ? 1.8 : 1.2}
            fill="none"
            strokeDasharray="5 4"
            style={{ transition: 'stroke 0.4s ease' }}
          />
        ))}

        {/* Animated dots */}
        <FlowDot path="#dp-left" dur={2.2} delay={0} />
        <FlowDot path="#dp-r2" dur={2.0} delay={0.2} />
        <FlowDot path="#dp-r0" dur={2.4} delay={0.6} />
        <FlowDot path="#dp-r4" dur={2.6} delay={1.0} />
        <FlowDot path="#dp-r1" dur={2.3} delay={1.4} />
        <FlowDot path="#dp-r3" dur={2.5} delay={0.8} />
      </svg>

      {/* Left card — Your Business */}
      <div className="absolute" style={{ left: 0, top: '50%', transform: 'translateY(-50%)', width: 175 }}>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-4" style={{ boxShadow: '0 4px 24px rgba(100,120,160,0.10)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3" style={{ fontFamily: 'var(--font-mono)' }}>Your Business</p>
          <div className="flex items-end gap-1 h-12 mb-3">
            {[25,45,70,55,90,65,85].map((h, i) => (
              <div key={i} className="flex-1 rounded-t" style={{
                height: `${h}%`,
                background: [2,4,6].includes(i) ? 'linear-gradient(to top, #EA6C0A, #FF6A00)' : '#EEF1F6',
                border: [2,4,6].includes(i) ? '1px solid #FF6A00' : '1px solid #E4E8F0',
                transition: 'height 0.8s ease'
              }} />
            ))}
          </div>
          {[['HubSpot CRM','30 deals'],['Xero Financials','Synced'],['Outlook','12 emails']].map(([l,v],i) => (
            <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg mb-1" style={{ background: '#F5F7FA', border: '1px solid #E4E8F0' }}>
              <span className="text-[10px] text-slate-500" style={{ fontFamily: 'var(--font-mono)' }}>{l}</span>
              <span className="text-[10px] font-bold text-orange-500" style={{ fontFamily: 'var(--font-mono)' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Center — BIQc node */}
      <div className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: 10 }}>
        <div className="flex flex-col items-center justify-center rounded-full bg-white"
          style={{
            width: 130, height: 130,
            border: '2px solid rgba(249,115,22,0.35)',
            boxShadow: '0 0 0 14px rgba(245,247,250,0.85), 0 0 0 28px rgba(245,247,250,0.45), 0 8px 40px rgba(100,120,160,0.12), 0 0 60px rgba(249,115,22,0.08)',
            animation: 'biqcPulse 3s ease-in-out infinite'
          }}>
          <div className="flex items-center justify-center rounded-2xl text-white font-black text-2xl mb-2"
            style={{ width: 44, height: 44, background: 'linear-gradient(135deg,#FF6A00,#C2410C)', fontFamily: 'var(--font-heading)', boxShadow: '0 4px 14px rgba(249,115,22,0.35)' }}>
            B
          </div>
          <span className="text-xs font-bold text-slate-900" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.01em' }}>BIQc</span>
          <span className="text-[9px] text-slate-400 mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>Intelligence</span>
        </div>
      </div>

      {/* Right — Integration rows */}
      <div className="absolute" style={{ right: 0, top: '50%', transform: 'translateY(-50%)', width: 185 }}>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-3" style={{ boxShadow: '0 4px 24px rgba(100,120,160,0.10)' }}>
          {integrations.map((row, i) => (
            <div key={i}
              className="flex items-center justify-between py-2 border-b last:border-b-0 transition-all duration-500"
              style={{
                borderColor: activeRow === i ? 'rgba(249,115,22,0.15)' : '#F1F5F9',
                background: activeRow === i ? 'rgba(249,115,22,0.04)' : 'transparent',
                borderRadius: activeRow === i ? 8 : 0,
                padding: '8px 6px',
              }}>
              <span className="text-[10px] font-semibold w-14 shrink-0" style={{ fontFamily: 'var(--font-mono)', color: activeRow === i ? '#FF6A00' : '#64748B' }}>{row.label}</span>
              <div className="flex gap-1.5">
                {row.items.map((item, j) => (
                  <div key={j} className="flex items-center justify-center rounded-lg text-white text-[9px] font-bold"
                    style={{ width: 22, height: 22, background: row.colors[j] || '#94A3B8', flexShrink: 0, fontFamily: 'var(--font-heading)' }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[9px] text-right text-slate-400 mt-2" style={{ fontFamily: 'var(--font-mono)' }}>and 500+ more →</p>
        </div>
      </div>

      <style>{`
        @keyframes biqcPulse {
          0%,100% { box-shadow: 0 0 0 14px rgba(245,247,250,0.85), 0 0 0 28px rgba(245,247,250,0.45), 0 8px 40px rgba(100,120,160,0.12), 0 0 60px rgba(249,115,22,0.08); }
          50% { box-shadow: 0 0 0 18px rgba(245,247,250,0.65), 0 0 0 36px rgba(245,247,250,0.25), 0 8px 40px rgba(100,120,160,0.12), 0 0 80px rgba(249,115,22,0.12); }
        }
      `}</style>
    </div>
  );
};

/* ═══ FEATURE CARDS ═══ */
const FeatureCards = () => {
  const [activeBar, setActiveBar] = useState(2);
  useEffect(() => {
    const t = setInterval(() => setActiveBar(b => (b + 1) % 4), 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Boardroom */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1" style={{ boxShadow: '0 2px 12px rgba(100,120,160,0.08)' }}>
        <div className="p-4 sm:p-6" style={{ background: 'linear-gradient(135deg,#EEF2FF,#E0E7FF)', minHeight: 140 }}>
          <div className="grid grid-cols-3 gap-2">
            {[['💰','Finance'],['⚡','BIQc'],['⚙️','Ops'],['📈','Sales'],['⚠️','Risk'],['🛡️','Compliance']].map(([e,l], i) => (
              <div key={i} className="flex flex-col items-center justify-center p-2 rounded-xl transition-all"
                style={{ background: i === 1 ? '#0F1720' : 'white', border: `1px solid ${i === 1 ? '#0F1720' : 'rgba(99,102,241,0.15)'}` }}>
                <span style={{ fontSize: 16 }}>{e}</span>
                <span className="text-[8px] font-bold mt-1" style={{ fontFamily: 'var(--font-mono)', color: i === 1 ? 'rgba(255,255,255,0.6)' : '#64748B', textTransform: 'uppercase' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>The Boardroom</h3>
          <p className="text-sm font-semibold text-slate-700 mb-2">Five AI agents debating your data in real time.</p>
          <p className="text-sm text-slate-500 leading-relaxed mb-4">Finance, Ops, Sales, Risk, and Compliance simultaneously analyse your business and deliver a unified strategic verdict.</p>
          <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors" style={{ fontFamily: 'var(--font-heading)' }}>Learn more <ArrowRight className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* BIQc Insights */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1" style={{ boxShadow: '0 2px 12px rgba(100,120,160,0.08)' }}>
        <div className="p-4 bg-slate-900" style={{ minHeight: 140 }}>
          <div className="flex gap-1.5 mb-3">
            {['#EF4444','#F59E0B','#10B981'].map(c => <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />)}
          </div>
          {[['ATO Compliance Check','OK','#FF6A00'],['Sales Velocity Deviation','Corrected','#FF6A00'],['Cash Flow Forecast','Attention','#F59E0B'],['Client Retention Score','94%','#4ADE80']].map(([l,v,c],i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg mb-1.5" style={{ background: `rgba(255,255,255,0.05)`, border: '1px solid rgba(255,255,255,0.06)', animation: `rowPulse 4s ease-in-out ${i*0.5}s infinite` }}>
              <span className="text-[10px] text-slate-400" style={{ fontFamily: 'var(--font-mono)' }}>{l}</span>
              <span className="text-[10px] font-bold" style={{ color: c, fontFamily: 'var(--font-mono)' }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>BIQc Insights</h3>
          <p className="text-sm font-semibold text-slate-700 mb-2">The always-on intelligence layer. Sub-second from cache.</p>
          <p className="text-sm text-slate-500 leading-relaxed mb-4">Radar-sweep detection of Silent Killers — forgotten invoices, SOP drift, compliance gaps — before they become crises.</p>
          <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors" style={{ fontFamily: 'var(--font-heading)' }}>Learn more <ArrowRight className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* SoundBoard */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1" style={{ boxShadow: '0 2px 12px rgba(100,120,160,0.08)' }}>
        <div className="flex flex-col items-center justify-center gap-4 p-6 sm:p-8" style={{ background: 'linear-gradient(135deg,#FFF7ED,#FFEDD5)', minHeight: 140 }}>
          <div className="flex items-end gap-1" style={{ height: 56 }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="w-1 rounded-full" style={{ background: '#FF6A00', height: `${8 + Math.abs(Math.sin(i * 0.7)) * 40}px`, animation: `waveBar ${0.8 + i * 0.06}s ease-in-out ${i * 0.04}s infinite alternate`, opacity: 0.7 + Math.abs(Math.sin(i * 0.7)) * 0.3 }} />
            ))}
          </div>
          <span className="text-sm font-semibold text-slate-700" style={{ fontFamily: 'var(--font-heading)' }}>🎤 Voice-to-Strategy Calibration</span>
        </div>
        <div className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>SoundBoard</h3>
          <p className="text-sm font-semibold text-slate-700 mb-2">Speak your challenges. Get structured action plans.</p>
          <p className="text-sm text-slate-500 leading-relaxed mb-4">Voice-to-strategy calibration built on your actual business data — not generic templates. Fastest path from problem to plan.</p>
          <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors" style={{ fontFamily: 'var(--font-heading)' }}>Learn more <ArrowRight className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Strategic Console */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1" style={{ boxShadow: '0 2px 12px rgba(100,120,160,0.08)' }}>
        <div className="p-4 sm:p-5" style={{ background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', minHeight: 140 }}>
          {[['Industry Trends — AU 2026','High Signal'],['Competitor Landscape','3 Gaps Found'],['Regulatory Changes','1 Update'],['Revenue Opportunity','Act Now']].map(([l,v],i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 bg-white rounded-lg mb-2 last:mb-0" style={{ border: '1px solid rgba(34,197,94,0.12)' }}>
              <span className="text-[11px] text-slate-500" style={{ fontFamily: 'var(--font-mono)' }}>{l}</span>
              <span className="text-[11px] font-bold text-emerald-600" style={{ fontFamily: 'var(--font-mono)' }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>Strategic Console</h3>
          <p className="text-sm font-semibold text-slate-700 mb-2">Daily executive briefing. Ask anything. Get answers.</p>
          <p className="text-sm text-slate-500 leading-relaxed mb-4">Live market intelligence, competitor tracking, and daily force memos. Your AI advisor calibrated to your exact situation.</p>
          <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors" style={{ fontFamily: 'var(--font-heading)' }}>Learn more <ArrowRight className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <style>{`
        @keyframes rowPulse { 0%,80%,100%{border-color:rgba(255,255,255,0.06)} 40%{border-color:rgba(249,115,22,0.25);background:rgba(249,115,22,0.05)} }
        @keyframes waveBar { from{transform:scaleY(0.4)} to{transform:scaleY(1)} }
      `}</style>
    </div>
  );
};

/* ═══ COMPARISON SECTION ═══ */
const ComparisonSection = () => {
  const [active, setActive] = useState(0);
  const passiveItems = ['Monthly Sales Report','Total Outstanding Invoices','Employee Hours & Overtime','Customer Complaints/Churn'];
  const activeItems = [
    { text: 'LATE PAYMENT: Client #47 hasn\'t paid.', action: 'Send Auto-Reminder', color: '#FF6A00' },
    { text: 'BUDGET ALERT: Overtime is 15% above target this week.', action: 'Adjust Schedule', color: '#3B82F6' },
    { text: 'SOP BREACH: 3 new leads haven\'t been called in 24 hours.', action: 'Notify Team', color: '#EF4444' },
    { text: 'PROFIT WIN: Supplier price just dropped 10%.', action: 'Restock Now', color: '#10B981' },
  ];

  return (
    <div>
      {/* Toggle */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center p-1 rounded-full" style={{ background: 'white', border: '1px solid rgba(180,195,215,0.35)', boxShadow: '0 2px 8px rgba(100,120,160,0.08)' }}>
          {['The Old Way','The BIQc Way'].map((label,i) => (
            <button key={i} onClick={() => setActive(i)}
              className="px-3 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200"
              style={{ fontFamily: 'var(--font-heading)', background: active === i ? '#0F1720' : 'transparent', color: active === i ? 'white' : '#64748B', boxShadow: active === i ? '0 2px 8px rgba(0,0,0,0.15)' : 'none' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
        {/* Passive */}
        <div className="bg-white rounded-2xl p-6 border transition-all duration-500"
          style={{ borderColor: active === 0 ? 'rgba(180,195,215,0.35)' : '#F1F5F9', opacity: active === 1 ? 0.4 : 1, boxShadow: '0 2px 12px rgba(100,120,160,0.06)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-4 text-slate-400" style={{ fontFamily: 'var(--font-mono)' }}>The Mental Load</p>
          {passiveItems.map((item,i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100 mb-2 text-sm text-slate-400" style={{ fontFamily: 'var(--font-mono)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
              {item}
            </div>
          ))}
          <p className="text-xs text-slate-400 mt-3 italic">You search. You analyze. You lose time.</p>
        </div>

        {/* Active */}
        <div className="bg-white rounded-2xl p-6 border transition-all duration-500"
          style={{ borderColor: active === 1 ? 'rgba(249,115,22,0.2)' : '#F1F5F9', opacity: active === 0 ? 0.4 : 1, background: active === 1 ? 'rgba(249,115,22,0.02)' : 'white', boxShadow: active === 1 ? '0 4px 24px rgba(249,115,22,0.08)' : '0 2px 12px rgba(100,120,160,0.06)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ fontFamily: 'var(--font-mono)', color: active === 1 ? '#FF6A00' : '#94A3B8' }}>Instant Resolution</p>
          {activeItems.map((item,i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-2 border transition-all duration-200" style={{ background: active === 1 ? 'white' : '#F8FAFC', borderColor: active === 1 ? 'rgba(249,115,22,0.1)' : '#F1F5F9' }}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: active === 1 ? item.color : '#CBD5E1', boxShadow: active === 1 ? `0 0 5px ${item.color}` : 'none' }} />
              <span className="text-[10px] flex-1 text-slate-600" style={{ fontFamily: 'var(--font-mono)' }}>{item.text}</span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ color: active === 1 ? item.color : '#94A3B8', background: active === 1 ? `${item.color}15` : '#F1F5F9', fontFamily: 'var(--font-mono)' }}>{item.action}</span>
            </div>
          ))}
          <p className="text-xs font-semibold mt-3" style={{ color: active === 1 ? '#FF6A00' : '#94A3B8' }}>It monitors. It alerts. You just hit "Approve."</p>
        </div>
      </div>
    </div>
  );
};

/* ═══ MAIN LANDING PAGE ═══ */
const LandingIntelligent = () => {
  const nav = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const typewritten = useTypewriter(['Instant, secure intelligence','Real-time threat detection','AI-powered clarity','Strategic foresight'], 70, 2400, 38);

  // ── SCROLL UNLOCK: force scroll ON whenever landing page mounts ──
  useEffect(() => {
    document.documentElement.style.overflowY = 'scroll';
    document.documentElement.style.height = 'auto';
    document.documentElement.style.position = 'static';
    document.documentElement.style.overscrollBehavior = 'auto';
    document.body.style.overflowY = 'visible';
    document.body.style.height = 'auto';
    document.body.style.position = 'static';
    document.body.style.overscrollBehavior = 'auto';
    const root = document.getElementById('root');
    if (root) { root.style.overflow = 'visible'; root.style.height = 'auto'; }
    return () => {
      document.documentElement.style.overflowY = '';
      document.body.style.overflowY = '';
    };
  }, []);

  const outcomes = [
    { icon: Clock, metric: '15+', unit: 'hrs/week', title: 'No More Overworking', desc: 'For the same results. BIQc watches sales calls, staff output, and operational drift while you focus on the $10K tasks.', color: '#3B82F6' },
    { icon: DollarSign, metric: '8–12%', unit: 'profit', title: 'Keep More of Your Cash', desc: 'Real-time detection of high CAC, zombie subscriptions, and tax liability mismatches — before they hit your bank balance.', color: '#FF6A00' },
    { icon: Users, metric: '97%', unit: 'SOP rate', title: 'Bring Simplicity into Your Business', desc: 'Standard Operating Processes that work. AI detects when steps are skipped or leads go cold, triggering intervention automatically.', color: '#10B981' },
  ];

  const pricingTiers = [
    { name: 'The Pulse', price: '149', tagline: 'Sentinel monitoring', features: ['24/7 Sentinel Monitoring','Risk & anomaly alerts','Business DNA profile','Weekly intelligence briefing','Email & calendar integration','1 user seat'], cta: 'Get started', highlight: false },
    { name: 'The Strategist', price: '1,950', tagline: 'Advisory calibration', features: ['Everything in The Pulse','Full BIQc Intelligence Matrix','Monthly Advisory Calibration','CRM & accounting integration','Board-ready intelligence memos','Up to 5 user seats'], cta: 'Get started', highlight: true },
    { name: 'The Sovereign', price: '5,500', tagline: 'Full sentinel integration', features: ['Everything in The Strategist','Weekly Force Memo Execution','Daily mentoring sessions','Custom integration pipeline','Dedicated advisor','Unlimited seats'], cta: 'Contact sales', highlight: false },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA', fontFamily: 'var(--font-body)', color: '#0F1720' }}>

      {/* Subtle grid + radial glow */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(180,195,215,0.12) 1px,transparent 1px),linear-gradient(90deg,rgba(180,195,215,0.12) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="absolute" style={{ top: '-10%', right: '-5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(200,210,230,0.25),transparent 70%)', filter: 'blur(40px)' }} />
        <div className="absolute" style={{ bottom: '-5%', left: '-5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(249,115,22,0.04),transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      {/* ── NAV ── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-5 sm:px-12" style={{ height: 64, background: 'rgba(245,247,250,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(180,195,215,0.35)' }}>
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => nav('/')}>
          <div className="flex items-center justify-center rounded-xl text-white font-black text-sm" style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#FF6A00,#C2410C)', fontFamily: 'var(--font-heading)', boxShadow: '0 3px 10px rgba(249,115,22,0.3)' }}>B</div>
          <span className="font-bold text-base text-slate-900" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>BIQc</span>
        </div>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {['Platform','Intelligence','Integrations','Pricing','Trust'].map(link => (
            <button key={link} className="text-sm font-medium text-slate-500 px-4 py-2 rounded-lg hover:bg-white hover:text-slate-900 transition-all" style={{ fontFamily: 'var(--font-body)' }}>{link}</button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => nav('/login-supabase')} className="hidden sm:flex text-sm font-medium text-slate-600 px-4 py-2 rounded-full border hover:bg-white transition-all" style={{ fontFamily: 'var(--font-heading)', borderColor: 'rgba(180,195,215,0.5)' }} data-testid="nav-login">Log in</button>
          <button onClick={() => nav('/register-supabase')} className="text-xs sm:text-sm font-semibold text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-full transition-all hover:-translate-y-0.5" style={{ fontFamily: 'var(--font-heading)', background: 'var(--biqc-bg)', boxShadow: '0 2px 10px rgba(0,0,0,0.18)' }} data-testid="nav-start-free">Get started →</button>
          {/* Mobile hamburger */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg ml-0.5 transition-all" style={{ background: mobileMenuOpen ? '#0F1720' : 'transparent', border: '1px solid rgba(180,195,215,0.5)' }}>
            {mobileMenuOpen ? <X className="w-4 h-4 text-white" /> : <Menu className="w-4 h-4 text-slate-700" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <div className="fixed top-16 inset-x-0 z-40 md:hidden" style={{ background: 'rgba(245,247,250,0.97)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(180,195,215,0.35)', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
          <div className="px-5 py-4 flex flex-col gap-1">
            {['Platform','Intelligence','Integrations','Pricing','Trust'].map(link => (
              <button key={link} onClick={() => setMobileMenuOpen(false)} className="text-left text-sm font-medium text-slate-700 px-4 py-3 rounded-xl hover:bg-white transition-all" style={{ fontFamily: 'var(--font-body)' }}>{link}</button>
            ))}
            <div className="h-px bg-slate-200 my-2" />
            <button onClick={() => { nav('/login-supabase'); setMobileMenuOpen(false); }} className="text-left text-sm font-medium text-slate-600 px-4 py-3 rounded-xl hover:bg-white transition-all" style={{ fontFamily: 'var(--font-body)' }}>Log in</button>
            <button onClick={() => { nav('/register-supabase'); setMobileMenuOpen(false); }} className="text-sm font-semibold text-white px-4 py-3 rounded-xl text-center" style={{ fontFamily: 'var(--font-heading)', background: '#FF6A00' }}>Get started →</button>
          </div>
        </div>
      )}

      {/* ── HERO ── */}
      <section className="relative z-10 pt-32 sm:pt-44 pb-16 sm:pb-24 px-6 sm:px-8 text-center" data-testid="hero-section">
        {/* Kicker */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-6" style={{ background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.2)' }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#FF6A00', animation: 'blink 1.8s ease-in-out infinite' }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)', color: '#EA6C0A' }}>Secure Business Intelligence</span>
        </div>

        {/* Heading with typewriter */}
        <h1 className="mx-auto mb-6 text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.08] max-w-4xl" style={{ fontFamily: 'var(--font-heading)' }}>
          <span style={{ color: '#FF6A00' }}>Run Your Business Like The Big </span>
          <span className="font-light" style={{ color: '#64748B' }}>Players </span>
          <span style={{ color: '#FF6A00' }}>Without The Cost</span>
        </h1>

        <div className="max-w-2xl mx-auto w-full text-left">
          <p className="mb-2 text-xl sm:text-2xl font-bold text-slate-800 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
            Meet BIQc..
          </p>
          <p className="mb-8 text-lg sm:text-xl font-medium leading-relaxed text-slate-500" style={{ fontFamily: 'var(--font-body)' }}>
            Your Digital Leadership team surfacing &amp; preventing risk weeks in advance
          </p>

          <p className="mb-8 text-base sm:text-lg leading-relaxed text-slate-500" style={{ fontFamily: 'var(--font-body)' }}>
            Your Chief Agent that deploys its team of AI agents that monitor, plan, execute, and optimize across your entire business.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 mb-4">
          <span className="text-sm font-semibold text-slate-700 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>Not a chatbot.</span>
          <button onClick={() => nav('/register-supabase')} className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-white text-sm sm:text-base font-semibold hover:-translate-y-0.5 transition-all" style={{ fontFamily: 'var(--font-heading)', background: 'var(--biqc-bg)', boxShadow: '0 3px 14px rgba(0,0,0,0.2)' }} data-testid="hero-cta-primary">
            <Shield className="w-4 h-4" strokeWidth={1.5} /> Try It For Free
          </button>
          <span className="text-sm font-semibold text-slate-700 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>Not a dashboard.</span>
        </div>
        <p className="text-xs text-slate-400" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>No credit card required · Australian owned & operated</p>
      </section>

      {/* ── COGNITION-AS-A-SERVICE ── */}
      <section className="relative z-10 py-16 sm:py-24 px-6 sm:px-8 lg:px-12" data-testid="cognition-section">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 pl-4 border-l-2" style={{ borderColor: '#FF6A00' }}>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>What Cognition-as-a-Service Delivers</h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>Industry benchmarks show that businesses embedding AI-driven decision systems experience:</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-12 gap-y-8 border-y py-10" style={{ borderColor: 'rgba(180,195,215,0.35)', background: 'rgba(255,255,255,0.4)' }}>
            {[
              { value: '40%', label: 'Improvement in operational efficiency' },
              { value: '50%', label: 'Reduction in manual workload' },
              { value: '80%', label: 'Lower finance processing costs' },
              { value: '3x', label: 'Faster anomaly detection' },
              { value: '-25%', label: 'Reduction in preventable errors' },
            ].map((s, i) => (
              <div key={i} className="flex flex-col gap-1">
                <span className="text-3xl sm:text-4xl font-extrabold leading-none" style={{ fontFamily: 'var(--font-heading)', color: '#FF6A00' }}>{s.value}</span>
                <span className="text-[10px] uppercase tracking-widest text-slate-500 leading-tight" style={{ fontFamily: 'var(--font-mono)' }}>{s.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm font-medium text-slate-700 italic" style={{ fontFamily: 'var(--font-heading)' }}>BIQc brings that cognitive layer to SMBs — without enterprise headcount.</p>
        </div>
      </section>

      {/* ── CONNECTION DIAGRAM ── */}
      <section className="relative z-10 pb-16 sm:pb-24 px-6 sm:px-8 hidden lg:block">
        <ConnectionDiagram />
      </section>

      {/* ── TRUST BAR ── */}
      <section className="relative z-10 py-16 sm:py-24 border-y" style={{ background: 'rgba(255,255,255,0.7)', borderColor: 'rgba(180,195,215,0.35)' }} data-testid="trust-strip">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-slate-400 mb-8" style={{ fontFamily: 'var(--font-mono)' }}>
            What <span style={{ color: '#FF6A00', textDecoration: 'underline', textUnderlineOffset: 3 }}>Australian businesses</span> are saying
          </p>
          <div className="flex flex-wrap gap-10 sm:gap-16">
            {[
              { quote: "BIQc spotted a cash leak we'd been missing for 6 months. Within a week of connecting Xero, we recovered $12,000.", name: 'Sarah M.', co: 'Melbourne Accounting Firm' },
              { quote: "I used to spend 3 hours every Monday pulling reports. Now BIQc hands me a briefing before my coffee.", name: 'James T.', co: 'Brisbane eCommerce' },
              { quote: "The SOP monitoring alone paid for itself. We caught 4 compliance gaps before our audit.", name: 'Lisa K.', co: 'Sydney Healthcare' },
            ].map((t, i) => (
              <div key={i} className="max-w-xs text-left">
                <p className="text-sm text-slate-500 italic leading-relaxed mb-3" style={{ fontFamily: 'var(--font-body)' }}>"{t.quote}"</p>
                <p className="text-sm font-semibold text-slate-700 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>{t.name}</p>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{t.co}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="relative z-10" style={{ background: 'white', borderBottom: '1px solid rgba(180,195,215,0.35)' }}>
        <div className="grid grid-cols-2 md:grid-cols-4 max-w-7xl mx-auto">
          {[['94%','faster loads','vs. live generation'],['15+','hrs/week','Reclaimed per operator'],['500+','integrations','Connected and syncing'],['24/7','sentinel','Always on, always watching']].map(([num,unit,desc],i) => (
            <div key={i} className="py-6 sm:py-10 px-3 sm:px-6 hover:bg-slate-50 transition-colors" style={{ borderRight: i % 2 === 0 ? '1px solid rgba(180,195,215,0.35)' : (i < 3 && i % 2 === 1 ? 'none' : 'none'), borderBottom: i < 2 ? '1px solid rgba(180,195,215,0.35)' : 'none' }}>
              <div className="text-3xl sm:text-5xl font-extrabold mb-1" style={{ fontFamily: 'var(--font-heading)', color: '#FF6A00', letterSpacing: '-0.04em' }}>{num}</div>
              <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1" style={{ fontFamily: 'var(--font-mono)' }}>{unit}</div>
              <div className="text-xs sm:text-sm text-slate-500 hidden sm:block">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="relative z-10 py-12 sm:py-24 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="mb-12 sm:mb-16 max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-px bg-orange-500" />
              <span className="text-xs font-semibold uppercase tracking-widest text-orange-500" style={{ fontFamily: 'var(--font-mono)' }}>The Functional Arsenal</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-slate-900 mb-4 tracking-tight leading-[1.1]" style={{ fontFamily: 'var(--font-heading)' }}>
              One platform.<br />Four pillars of intelligence.
            </h2>
            <p className="text-base sm:text-lg text-slate-500 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>Every screen built for decisions, not analysis.</p>
          </div>
          <FeatureCards />
        </div>
      </section>

      {/* ── COMPARISON ── */}
      <section className="relative z-10 py-20 sm:py-32 px-6 sm:px-8 lg:px-12" style={{ background: '#F5F7FA' }} data-testid="sigma-comparison">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 sm:mb-16 max-w-3xl">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-orange-500" style={{ fontFamily: 'var(--font-mono)' }}>Intelligence Evolution</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
              Dashboards tell you what happened.<br />
              <span style={{ color: '#3B82F6' }}>BIQc fixes what's happening.</span>
            </h2>
            <p className="text-sm sm:text-base text-slate-500 max-w-xl leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>Stop digging through charts to find problems. BIQc spots the leaks and hands you the solution — before you lose money.</p>
          </div>
          <ComparisonSection />
        </div>
      </section>

      {/* ── WIIFM ── */}
      <section className="relative z-10 py-20 sm:py-32 px-6 sm:px-8 lg:px-12" style={{ background: 'white' }} data-testid="outcome-matrix">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 sm:mb-16 max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-orange-500" style={{ fontFamily: 'var(--font-mono)' }}>What Life Looks Like with BIQc</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-5xl font-extrabold text-slate-900 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>What's in it for you?</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
            {outcomes.map((o,i) => {
              const Icon = o.icon;
              return (
                <div key={i} className="bg-white rounded-2xl p-5 sm:p-7 border hover:shadow-xl transition-all duration-300 hover:-translate-y-1" style={{ borderColor: 'rgba(180,195,215,0.35)', boxShadow: '0 2px 12px rgba(100,120,160,0.06)' }}>
                  <div className="flex items-center gap-3 mb-4 sm:mb-5">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${o.color}12` }}><Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: o.color }} strokeWidth={1.8} /></div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl sm:text-2xl font-extrabold" style={{ fontFamily: 'var(--font-heading)', color: o.color, letterSpacing: '-0.03em' }}>{o.metric}</span>
                      <span className="text-xs text-slate-400" style={{ fontFamily: 'var(--font-mono)' }}>{o.unit}</span>
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2" style={{ fontFamily: 'var(--font-heading)' }}>{o.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-4">{o.desc}</p>
                  <div className="pt-3 sm:pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-400"><span className="font-semibold" style={{ color: o.color }}>BIQc Edge: </span>Powered by calibrated intelligence unique to your business.</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="relative z-10 py-20 sm:py-32 px-6 sm:px-8 lg:px-12" style={{ background: '#F5F7FA' }} data-testid="pricing-section">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 sm:mb-16 max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-orange-500" style={{ fontFamily: 'var(--font-mono)' }}>Strategic Pricing Ladder</span>
            </div>
            <h2 className="text-xl sm:text-3xl lg:text-5xl font-extrabold text-slate-900 mb-3 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>Intelligence at every scale</h2>
            <p className="text-sm text-slate-500" style={{ fontFamily: 'var(--font-body)' }}>All prices in AUD. Cancel anytime. 14-day free trial on The Pulse.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {pricingTiers.map((tier, i) => (
              <div key={i} className={`rounded-2xl p-5 sm:p-7 flex flex-col transition-all hover:-translate-y-1 duration-300 ${tier.highlight ? 'sm:col-span-2 md:col-span-1' : ''}`} style={{ background: tier.highlight ? '#0F1720' : 'white', border: tier.highlight ? 'none' : '1px solid rgba(180,195,215,0.35)', boxShadow: tier.highlight ? '0 8px 40px rgba(0,0,0,0.2)' : '0 2px 12px rgba(100,120,160,0.06)', position: 'relative', order: tier.highlight ? -1 : 'unset' }}>
                {tier.highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white" style={{ background: '#FF6A00', fontFamily: 'var(--font-mono)' }}>Recommended</div>}
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-mono)', color: tier.highlight ? '#93C5FD' : '#64748B' }}>{tier.tagline}</p>
                <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'var(--font-heading)', color: tier.highlight ? 'white' : '#0F1720', letterSpacing: '-0.02em' }}>{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold" style={{ fontFamily: 'var(--font-heading)', color: tier.highlight ? 'white' : '#0F1720', letterSpacing: '-0.04em' }}>${tier.price}</span>
                  <span className="text-sm" style={{ color: tier.highlight ? '#94A3B8' : '#64748B' }}>/mo</span>
                </div>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {tier.features.map((f,j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm">
                      <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: tier.highlight ? '#60A5FA' : '#FF6A00' }} strokeWidth={2.5} />
                      <span style={{ color: tier.highlight ? '#CBD5E1' : '#475569', fontFamily: 'var(--font-body)' }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={() => nav('/register-supabase')} className="w-full py-3.5 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5" style={{ fontFamily: 'var(--font-heading)', background: tier.highlight ? '#3B82F6' : '#0F1720', color: 'white', boxShadow: tier.highlight ? '0 3px 14px rgba(37,99,235,0.3)' : '0 2px 8px rgba(0,0,0,0.15)' }}>
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative z-10 py-20 sm:py-32 px-6 sm:px-8 lg:px-12 overflow-hidden" style={{ background: 'var(--biqc-bg)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%,rgba(249,115,22,0.07),transparent)' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="relative z-10 max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-4xl lg:text-6xl font-extrabold text-white mb-5 tracking-tight leading-[1.07]" style={{ fontFamily: 'var(--font-heading)' }}>
            Business clarity,<br /><span style={{ color: '#FF6A00' }}>mastered.</span>
          </h2>
          <p className="text-base sm:text-lg text-slate-400 mb-8" style={{ fontFamily: 'var(--font-body)' }}>Connect your systems. Let BIQc build context. Act with confidence.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={() => nav('/register-supabase')} className="flex items-center justify-center gap-2 px-8 py-4 rounded-full text-white text-sm sm:text-base font-semibold w-full sm:w-auto" style={{ fontFamily: 'var(--font-heading)', background: '#FF6A00', boxShadow: '0 4px 20px rgba(249,115,22,0.35)' }} data-testid="final-cta">Run your free Snapshot <ArrowRight className="w-4 h-4" /></button>
            <button onClick={() => nav('/register-supabase')} className="flex items-center justify-center gap-2 px-8 py-4 rounded-full text-sm sm:text-base font-semibold w-full sm:w-auto" style={{ fontFamily: 'var(--font-heading)', background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.12)' }}>Try It For Free</button>
          </div>
          <p className="text-xs text-slate-600 mt-5" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Free to start · No credit card · Australian owned and operated</p>
        </div>
      </section>

      {/* Australian Trust Bar */}
      <div className="relative z-10 py-3 px-6 text-center flex items-center justify-center gap-2" style={{ background: 'rgba(5,150,105,0.06)', borderTop: '1px solid rgba(5,150,105,0.15)', borderBottom: '1px solid rgba(5,150,105,0.15)' }}>
        <Shield className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2} />
        <p className="text-xs text-slate-600" style={{ fontFamily: 'var(--font-mono)' }}>
          <strong className="text-emerald-700">Securely Built & Hosted in Australia</strong> · Your data stays on Australian soil, protected by local privacy laws and zero foreign access.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="relative z-10 py-5 px-6 text-center" style={{ background: '#243140', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs text-slate-500 leading-relaxed max-w-3xl mx-auto">
          <strong className="text-slate-400">Important:</strong> Business Intelligence Quotient Centre provides general information and educational content only. It does not constitute financial, legal, tax, or professional advice. See our <button onClick={() => nav('/terms')} style={{ color: '#FF6A00', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Terms and Conditions</button> for full details.
        </p>
      </div>

      {/* Footer */}
      <footer className="relative z-10 px-4 sm:px-6 py-6 sm:py-8 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ background: '#080E18', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center rounded-xl text-white font-black text-xs" style={{ width: 28, height: 28, background: 'rgba(249,115,22,0.2)', fontFamily: 'var(--font-heading)' }}>B</div>
          <span className="text-[10px] sm:text-xs text-slate-600" style={{ fontFamily: 'var(--font-mono)' }}>© 2026 BIQc — Business IQ Centre</span>
        </div>
        <div className="flex flex-wrap justify-center gap-3 sm:gap-5">
          {['Pricing','Trust & Security','Terms','Enterprise Terms','Privacy'].map(l => <button key={l} onClick={() => l === 'Pricing' ? nav('/pricing') : l === 'Trust & Security' ? nav('/trust') : l === 'Terms' ? nav('/terms') : l === 'Enterprise Terms' ? nav('/enterprise-terms') : l === 'Privacy' ? nav('/trust/privacy') : null} className="text-[10px] sm:text-xs text-slate-600 hover:text-slate-400 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>{l}</button>)}
        </div>
      </footer>

      {/* Sovereign badge */}
      <div className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-40 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(180,195,215,0.4)', boxShadow: '0 4px 20px rgba(100,120,160,0.15)' }} data-testid="sovereign-badge">
        <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#F59E0B,#3B82F6)' }}><Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" strokeWidth={2.5} /></div>
        <span className="text-[10px] sm:text-xs font-semibold text-slate-700" style={{ fontFamily: 'var(--font-mono)' }}>Australian Sovereign Data</span>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  );
};

export default LandingIntelligent;
