import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, Zap, Eye } from 'lucide-react';
import { fontFamily } from '../../../design-system/tokens';


const PlatformLogin = () => (
  <div className="min-h-screen flex" style={{ background: '#0F1720' }}>
    {/* Left: Login Form */}
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#FF6A00' }}>
            <span className="text-white font-bold text-sm" style={{ fontFamily: fontFamily.mono }}>B</span>
          </div>
          <div>
            <span className="text-lg font-semibold text-[#F4F7FA] block" style={{ fontFamily: fontFamily.display }}>BIQc</span>
            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>powered by Business Intelligence Quotient Centre</span>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-2" style={{ fontFamily: fontFamily.display }}>Welcome back</h1>
        <p className="text-sm text-[#9FB0C3] mb-8" style={{ fontFamily: fontFamily.body }}>Demo preview. Use secure sign-in to access the live platform.</p>

        {/* Social Logins */}
        <div className="space-y-3 mb-6">
          <Link to="/login-supabase" className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium text-[#F4F7FA] transition-colors hover:bg-white/10" style={{ fontFamily: fontFamily.body, background: '#141C26', border: '1px solid #243140' }} data-testid="google-login">
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EF4444"/></svg>
            Continue with Google
          </Link>
          <Link to="/login-supabase" className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium text-[#F4F7FA] transition-colors hover:bg-white/10" style={{ fontFamily: fontFamily.body, background: '#141C26', border: '1px solid #243140' }} data-testid="microsoft-login">
            <svg className="w-4 h-4" viewBox="0 0 23 23"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="12" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="12" width="10" height="10" fill="#00A4EF"/><rect x="12" y="12" width="10" height="10" fill="#FFB900"/></svg>
            Continue with Microsoft
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px" style={{ background: '#243140' }} />
          <span className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>or continue with email</span>
          <div className="flex-1 h-px" style={{ background: '#243140' }} />
        </div>

        {/* Form */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="text-xs font-medium text-[#9FB0C3] block mb-1.5" style={{ fontFamily: fontFamily.body }}>EMAIL</label>
            <input type="email" placeholder="you@company.com" className="w-full px-3.5 py-2.5 rounded-lg text-sm text-[#F4F7FA] outline-none transition-all focus:border-[#FF6A00]" style={{ fontFamily: fontFamily.body, background: '#0A1018', border: '1px solid #243140' }} data-testid="email-input" />
          </div>
          <div>
            <label className="text-xs font-medium text-[#9FB0C3] block mb-1.5" style={{ fontFamily: fontFamily.body }}>PASSWORD</label>
            <input type="password" placeholder="••••••••" className="w-full px-3.5 py-2.5 rounded-lg text-sm text-[#F4F7FA] outline-none transition-all focus:border-[#FF6A00]" style={{ fontFamily: fontFamily.body, background: '#0A1018', border: '1px solid #243140' }} data-testid="password-input" />
          </div>
        </div>

        <Link to="/login-supabase" className="w-full flex items-center justify-center px-4 py-3 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110" style={{ background: '#FF6A00', fontFamily: fontFamily.display }} data-testid="signin-btn">
          Sign in
        </Link>

        <p className="text-xs text-[#64748B] text-center mt-4" style={{ fontFamily: fontFamily.body }}>
          Don't have an account? <Link to="/register-supabase" className="text-[#FF6A00] font-medium">Get started</Link>
        </p>
      </div>
    </div>

    {/* Right: Trust Panel */}
    <div className="hidden lg:flex flex-1 items-center justify-center px-12" style={{ background: '#0A1018', borderLeft: '1px solid #243140' }}>
      <div className="max-w-sm">
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#FF6A00] block mb-4" style={{ fontFamily: fontFamily.mono }}>Sovereign Intelligence</span>
        <h2 className="text-2xl font-semibold text-[#F4F7FA] mb-3 leading-tight" style={{ fontFamily: fontFamily.display }}>Your business intelligence, protected by design.</h2>
        <p className="text-sm text-[#9FB0C3] mb-8 leading-relaxed" style={{ fontFamily: fontFamily.body }}>100% Australian data sovereignty. Zero leakage. Military-grade encryption.</p>

        <div className="space-y-3">
          {[
            { icon: Lock, label: 'AES-256 Encryption', desc: 'Defence-grade protection' },
            { icon: Zap, label: 'Real-time Signals', desc: 'Business intelligence on autopilot' },
            { icon: Eye, label: 'Zero Leakage', desc: 'Siloed AI instances per client' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: '#141C26', border: '1px solid #243140' }}>
              <item.icon className="w-4 h-4 text-[#FF6A00] shrink-0" />
              <div>
                <span className="text-sm font-medium text-[#F4F7FA] block" style={{ fontFamily: fontFamily.display }}>{item.label}</span>
                <span className="text-[11px] text-[#64748B]" style={{ fontFamily: fontFamily.body }}>{item.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2 px-4 py-3 rounded-lg" style={{ background: '#10B981' + '10', border: '1px solid #10B98120' }}>
          <Shield className="w-4 h-4 text-[#10B981]" />
          <span className="text-xs text-[#10B981]" style={{ fontFamily: fontFamily.mono }}>Data hosted exclusively in Sydney & Melbourne</span>
        </div>
      </div>
    </div>
  </div>
);

export default PlatformLogin;
