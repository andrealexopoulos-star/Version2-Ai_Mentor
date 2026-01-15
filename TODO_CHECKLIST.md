# Strategy Squad - Supabase Migration & Enhancement Checklist
## Complete To-Do List & Backlog

Last Updated: January 15, 2026
Status: OAuth Authentication Working ✅

---

## 🎯 PHASE 1: CRITICAL MIGRATION FIXES (P0 - Must Complete Before New Features)

### ✅ COMPLETED
- [x] Supabase project setup with PostgreSQL
- [x] Database schema created (6 tables)
- [x] Google OAuth configured and working
- [x] Azure/Microsoft OAuth configured
- [x] Backend Supabase auth module created
- [x] Frontend Supabase auth context created
- [x] New login/register pages with OAuth buttons
- [x] OAuth callback handler working
- [x] ProtectedRoute supporting Supabase auth
- [x] Advisor page supporting Supabase auth
- [x] DashboardLayout supporting Supabase auth
- [x] Onboarding flow for new OAuth users
- [x] Logout redirecting to correct page

### 🔴 CRITICAL - DO BEFORE ANYTHING ELSE

#### A. Auth Flow Stabilization
- [ ] Test Microsoft OAuth end-to-end (sign up + login)
- [ ] Test email/password registration flow
- [ ] Test email/password login flow
- [ ] Verify onboarding wizard works for OAuth users
- [ ] Verify existing users skip onboarding correctly
- [ ] Test logout → login flow with all auth methods

#### B. Protected Routes Migration
- [ ] Update MyIntel page to support Supabase auth
- [ ] Update MySoundboard page to support Supabase auth
- [ ] Update BusinessProfile page to support Supabase auth
- [ ] Update Settings page to support Supabase auth
- [ ] Update Integrations page to support Supabase auth
- [ ] Update all remaining protected pages to support Supabase auth

#### C. Data Migration & Integrity
- [ ] Add Row Level Security (RLS) policies to all Supabase tables
- [ ] Test Cognitive Core with Supabase (ensure 4-layer persistence works)
- [ ] Test advisory log functionality with Supabase
- [ ] Test soundboard message storage with Supabase
- [ ] Verify master account privileges work (andre@thestrategysquad.com.au)

#### D. Link Updates & Navigation
- [ ] Audit ALL links in landing page → ensure point to /login-supabase, /register-supabase
- [ ] Audit ALL internal navigation links in dashboard
- [ ] Update footer links
- [ ] Update header/nav links
- [ ] Update email templates with correct URLs
- [ ] Update "Forgot Password" link to use Supabase flow

---

## 🔐 PHASE 2: SECURITY FEATURES (P1 - High Priority)

### Email Verification & Confirmation
- [ ] Enable email confirmation in Supabase Auth settings
- [ ] Create custom email confirmation template (branded)
- [ ] Add "Resend confirmation email" functionality
- [ ] Add "Email not confirmed" banner on dashboard
- [ ] Test confirmation flow end-to-end

### Password Management
- [ ] Implement "Forgot Password" link on login page
- [ ] Create password reset page using Supabase Auth
- [ ] Create branded password reset email template
- [ ] Add password strength indicator on registration
- [ ] Add password validation rules (min 8 chars, uppercase, number, special char)
- [ ] Test password reset flow end-to-end

### Failed Login Attempts & Security
- [ ] Implement failed login attempt tracking
- [ ] Add account lockout after 5 failed attempts (15 min)
- [ ] Add "Account locked" notification
- [ ] Add email notification for suspicious login attempts
- [ ] Add email notification for new device login
- [ ] Log all login attempts (IP, device, timestamp)

### Two-Factor Authentication (2FA)
- [ ] Research Supabase 2FA options
- [ ] Implement 2FA setup flow in Settings page
- [ ] Add 2FA verification step during login
- [ ] Add backup codes generation
- [ ] Add 2FA recovery flow
- [ ] Test 2FA end-to-end

### Session Management
- [ ] Implement session timeout (30 min inactivity)
- [ ] Add "Remember me" option on login
- [ ] Add "Active sessions" view in Settings
- [ ] Add "Log out all devices" functionality
- [ ] Implement secure token refresh

---

## 📝 PHASE 3: LANDING PAGE CONTENT OVERHAUL (P1 - High Priority)

### Content Themes to Emphasize
- [ ] **Security & Privacy**
  - [ ] Add "Bank-grade encryption" messaging
  - [ ] Add "Your data, your control" section
  - [ ] Add security certifications/badges
  - [ ] Add "We never sell your data" guarantee

- [ ] **Data Sovereignty**
  - [ ] Add "Australian data hosting" (if applicable)
  - [ ] Add "Choose your data region" feature
  - [ ] Add "GDPR compliant" messaging
  - [ ] Add data ownership clarity

- [ ] **Unlocking Hidden & Forgotten Data**
  - [ ] Add "Surface buried insights" section
  - [ ] Add "Connect your scattered data" messaging
  - [ ] Add "Rediscover forgotten opportunities" section
  - [ ] Add visualization of data fragmentation problem

- [ ] **Historical Learning & Observation**
  - [ ] Add "AI that learns YOUR business over time" section
  - [ ] Add "Cognitive Core" explainer
  - [ ] Add "Compounding intelligence" concept
  - [ ] Add timeline visualization of AI learning
  - [ ] Add "Never starts from scratch" messaging

### Landing Page Sections to Update
- [ ] Hero section - new headline focused on security + intelligence
- [ ] Trust signals section (security, certifications, testimonials)
- [ ] "How it works" - emphasize Cognitive Core
- [ ] Feature comparison table
- [ ] FAQ section about security & privacy
- [ ] Footer - add trust badges

---

## 🎨 PHASE 4: UI/UX AESTHETIC IMPROVEMENTS (P2 - Medium Priority)

### Landing Page Design
- [ ] **Hero Section**
  - [ ] Improve headline typography (bigger, bolder)
  - [ ] Better hero image/illustration
  - [ ] Animate hero elements on scroll
  - [ ] Improve CTA button design (see below)

- [ ] **CTA Buttons - Comprehensive Overhaul**
  - [ ] Increase button size (min height: 56px)
  - [ ] Add subtle shadow/depth
  - [ ] Add hover animations (scale/shine effect)
  - [ ] Add loading state for CTAs
  - [ ] Use action-oriented copy ("Start Free Now" vs "Sign Up")
  - [ ] Add urgency indicators where appropriate
  - [ ] Ensure high contrast (WCAG AAA)
  - [ ] Add icons to primary CTAs
  - [ ] Mobile: Make buttons thumb-friendly (48px min touch target)

- [ ] **Visual Hierarchy**
  - [ ] Improve spacing/whitespace
  - [ ] Better section separators
  - [ ] Consistent color palette
  - [ ] Improve typography scale

- [ ] **Interactive Elements**
  - [ ] Add micro-animations
  - [ ] Add scroll-triggered animations
  - [ ] Improve loading states
  - [ ] Add skeleton screens

### Dashboard/Platform UI
- [ ] **Sidebar Navigation**
  - [ ] Improve active state indicators
  - [ ] Add hover effects
  - [ ] Better icon consistency
  - [ ] Collapsible sidebar option

- [ ] **Advisor Interface**
  - [ ] Improve message bubbles design
  - [ ] Better loading states
  - [ ] Add typing indicators
  - [ ] Improve focus area cards

- [ ] **Overall Dashboard**
  - [ ] Consistent card shadows
  - [ ] Better empty states
  - [ ] Improve form designs
  - [ ] Better table designs
  - [ ] Improve modal designs

### Dark/Light Mode
- [ ] Fix dark mode toggle (currently broken - UI_P2_001)
- [ ] Ensure all components support dark mode
- [ ] Add smooth theme transition animation
- [ ] Save theme preference to database

### Mobile Responsiveness
- [ ] Audit all pages on mobile
- [ ] Fix any layout issues
- [ ] Improve touch targets
- [ ] Test on various screen sizes

---

## 🧪 PHASE 5: TESTING & QUALITY ASSURANCE (P1 - High Priority)

### Authentication Testing
- [ ] Test all auth flows in multiple browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test on mobile devices (iOS, Android)
- [ ] Test OAuth with multiple Google accounts
- [ ] Test OAuth with multiple Microsoft accounts
- [ ] Test edge cases (network interruption, slow connection)
- [ ] Load testing (concurrent logins)

### Security Testing
- [ ] Penetration testing for auth endpoints
- [ ] SQL injection testing
- [ ] XSS vulnerability testing
- [ ] CSRF protection verification
- [ ] Rate limiting testing
- [ ] Session hijacking prevention testing

### User Experience Testing
- [ ] Complete user journey testing (sign up → onboarding → first use)
- [ ] A/B test landing page variants
- [ ] Heatmap analysis
- [ ] User feedback collection
- [ ] Accessibility audit (WCAG 2.1 AA minimum)

---

## 🔄 PHASE 6: MONGODB RETIREMENT (P2 - After Stabilization)

### Data Migration
- [ ] Export all existing MongoDB data
- [ ] Migrate historical data to Supabase (if needed)
- [ ] Verify data integrity
- [ ] Run data validation scripts

### Code Cleanup
- [ ] Remove MongoDB dependencies from package.json
- [ ] Remove MongoDB auth endpoints from backend
- [ ] Remove old Login.js and Register.js pages
- [ ] Remove AuthContext.js (MongoDB auth context)
- [ ] Update all imports
- [ ] Clean up environment variables

### Documentation
- [ ] Document new auth flow
- [ ] Update API documentation
- [ ] Update deployment guides
- [ ] Create rollback plan (in case of issues)

---

## 📊 PHASE 7: MONITORING & ANALYTICS (P2 - Medium Priority)

### Auth Analytics
- [ ] Track OAuth conversion rates (Google vs Microsoft vs Email)
- [ ] Track onboarding completion rates
- [ ] Track time-to-first-value
- [ ] Track failed login attempts
- [ ] Track password reset requests

### User Behavior
- [ ] Implement analytics (PostHog, Mixpanel, or GA4)
- [ ] Track feature usage
- [ ] Track user retention
- [ ] Track churn indicators
- [ ] A/B testing framework

### Error Monitoring
- [ ] Implement error tracking (Sentry)
- [ ] Set up alerting for critical errors
- [ ] Monitor API response times
- [ ] Monitor database query performance

---

## 🚀 PHASE 8: ENHANCEMENTS & NEW FEATURES (P3 - Future)

### New Auth Options
- [ ] LinkedIn OAuth
- [ ] Apple Sign In
- [ ] SSO for enterprise customers
- [ ] Magic link login (passwordless)

### Advanced Features
- [ ] Team accounts/workspaces
- [ ] User roles & permissions
- [ ] Audit logs
- [ ] API key management for developers
- [ ] Webhooks

### Cognitive Core Enhancements
- [ ] Visual Cognitive Core dashboard
- [ ] Export Cognitive Core data
- [ ] Share Cognitive insights
- [ ] Cognitive Core version history

---

## 📋 IMMEDIATE ACTION ITEMS (Next Session)

### Priority 1 (Must Do First):
1. ✅ Test Microsoft OAuth login
2. ✅ Test email/password registration
3. ✅ Update all landing page links to /login-supabase and /register-supabase
4. ✅ Add RLS policies to Supabase tables
5. ✅ Test onboarding flow thoroughly

### Priority 2 (Do Next):
6. Implement password reset flow
7. Enable email confirmation
8. Update landing page content (security focus)
9. Improve CTA button design
10. Fix dark mode toggle

### Priority 3 (Then):
11. Implement 2FA
12. Update remaining protected pages
13. Failed login tracking
14. Comprehensive testing

---

## 📝 SIGN-OFF CHECKLIST

Before adding ANY new features, these must be ✅:

### Core Functionality
- [ ] All auth methods working (Google, Microsoft, Email/Password)
- [ ] Onboarding working for new users
- [ ] Existing users skip onboarding correctly
- [ ] All protected pages accessible with Supabase auth
- [ ] Logout working correctly
- [ ] Password reset working

### Security
- [ ] Email confirmation enabled and working
- [ ] RLS policies applied to all tables
- [ ] Failed login attempts tracked
- [ ] Session management secure

### UX/UI
- [ ] All links updated and working
- [ ] Landing page content updated
- [ ] CTA buttons improved
- [ ] Dark mode working
- [ ] Mobile responsive

### Testing
- [ ] All auth flows tested end-to-end
- [ ] Cross-browser testing complete
- [ ] Mobile testing complete
- [ ] No critical bugs

### Documentation
- [ ] Auth flow documented
- [ ] API endpoints documented
- [ ] Deployment process documented

---

## 🎯 SUCCESS METRICS

### Auth Performance
- OAuth conversion rate: Target >60%
- Email confirmation rate: Target >80%
- Onboarding completion: Target >70%
- Login success rate: Target >95%

### Security
- Failed login attempts: <5% of total
- Account lockouts: <1% of users
- 2FA adoption: Target >30% (when implemented)
- Zero security incidents

### UX
- Time to first login: Target <2 minutes
- Bounce rate on landing: Target <40%
- CTA click-through: Target >15%
- Mobile conversion: Target >50% of desktop

---

**STATUS LEGEND:**
- 🔴 Critical (P0) - Blocks everything else
- 🟠 High Priority (P1) - Do before new features
- 🟡 Medium Priority (P2) - Important but not blocking
- 🟢 Low Priority (P3) - Nice to have

**NEXT REVIEW:** After Priority 1 items are complete
