# Strategy Squad - Operations Manual
## Supabase Migration Project Documentation

**Document Version:** 1.0  
**Last Updated:** January 15, 2026  
**Project:** MongoDB to Supabase Migration  
**Status:** Phase 3-4 Complete, OAuth Working

---

# Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Authentication System](#authentication-system)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Environment Configuration](#environment-configuration)
7. [Deployment Guide](#deployment-guide)
8. [Testing Procedures](#testing-procedures)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Outstanding Items & Roadmap](#outstanding-items--roadmap)

---

# 1. Executive Summary

## Project Overview

**The Strategy Squad** is a hyper-personalized AI business advisor platform featuring:
- **MyIntel**: Real-time business signals and intelligence
- **MyAdvisor**: Strategic guidance and decision support  
- **MySoundboard**: Voice-enabled thinking partner

**Core Differentiator:** Per-User Cognitive Core - a 4-layer persistent intelligence system that compounds understanding over time, never resets, and learns from every interaction.

## Current Migration Status

### ✅ Completed (Phases 0-4)
- Supabase project setup with PostgreSQL database
- Google OAuth authentication (WORKING)
- Azure/Microsoft OAuth configuration (ready to test)
- Backend Supabase auth module
- Frontend Supabase auth integration
- OAuth callback flow with onboarding
- Protected route system supporting Supabase
- API client updated to send Supabase tokens

### 🔧 In Progress
- Testing Microsoft OAuth
- Testing email/password authentication
- Onboarding wizard validation
- Full user journey testing

### ⏸️ Not Started
- Row Level Security (RLS) policies (CRITICAL!)
- Email confirmation
- Password reset flow
- 2FA implementation
- MongoDB retirement
- Production deployment

---

# 2. System Architecture

## Technology Stack

### Frontend
- **Framework:** React 18
- **Routing:** React Router v6
- **Styling:** Tailwind CSS + shadcn/ui components
- **State Management:** Context API
- **HTTP Client:** Axios
- **Auth Library:** @supabase/supabase-js v2.90.1

### Backend
- **Framework:** FastAPI (Python)
- **Database (Legacy):** MongoDB via Motor (async)
- **Database (New):** Supabase PostgreSQL
- **Auth:** Supabase Auth + Custom JWT (transitional)
- **AI Integration:** OpenAI GPT-4o, Emergent LLM Key
- **Email/Calendar:** Microsoft Graph API (Outlook)

### Infrastructure
- **Hosting:** Emergent Platform (Kubernetes)
- **Environment:** Preview URL (staging)
- **Services:** Supervisor-managed (backend, frontend, MongoDB)
- **Ports:** Backend: 8001, Frontend: 3000

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (Browser)                        │
│  React App (localhost:3000 / preview URL)                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                   AUTHENTICATION LAYER                       │
│                                                              │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │ Supabase Auth│      │ MongoDB Auth │                    │
│  │   (Primary)  │      │  (Legacy)    │                    │
│  └──────────────┘      └──────────────┘                    │
│         │                      │                             │
│         └──────────┬───────────┘                            │
│                    ↓                                         │
│            SupabaseAuthContext                              │
│            + AuthContext (dual)                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                         │
│                   Port 8001 (internal)                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Auth Endpoints:                                      │  │
│  │  • /api/auth/supabase/signup                         │  │
│  │  • /api/auth/supabase/login                          │  │
│  │  • /api/auth/supabase/oauth/{provider}               │  │
│  │  • /api/auth/register (MongoDB - legacy)             │  │
│  │  • /api/auth/login (MongoDB - legacy)                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Business Logic:                                      │  │
│  │  • Cognitive Core (cognitive_core.py)                │  │
│  │  • AI Agents (MyIntel, MyAdvisor, MySoundboard)      │  │
│  │  • Outlook Integration (Microsoft Graph API)         │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────┬──────────────────────────┬──────────────────────┘
            │                          │
            ↓                          ↓
┌──────────────────────┐   ┌──────────────────────┐
│   Supabase           │   │   MongoDB            │
│   PostgreSQL         │   │   (Legacy)           │
│   (Primary)          │   │   Port 27017         │
│                      │   │                      │
│ Tables:              │   │ Collections:         │
│ • users              │   │ • users              │
│ • cognitive_profiles │   │ • chat_history       │
│ • advisory_log       │   │ • business_profiles  │
│ • soundboard_*       │   │ • outlook_emails     │
│ • microsoft_tokens   │   │ • documents          │
└──────────────────────┘   └──────────────────────┘
```

---

# 3. Authentication System

## Overview

The app currently supports **dual authentication** during migration:
1. **Supabase Auth (Primary/New)** - OAuth (Google, Azure) + Email/Password
2. **MongoDB Auth (Legacy)** - Email/Password only

## Supabase Authentication Flow

### Sign Up with OAuth (Google/Microsoft)

```
User clicks "Continue with Google/Microsoft"
         ↓
Confirmation dialog shown
         ↓
User clicks "OK"
         ↓
Redirect to Google/Microsoft
         ↓
Account picker shown (forced)
         ↓
User selects account & approves
         ↓
Redirect to: /auth/callback
         ↓
AuthCallbackSupabase component:
  • Extracts access_token from URL hash
  • Calls supabase.auth.getSession()
  • Checks if user is new (created < 30 sec ago)
         ↓
If NEW user → /onboarding
If EXISTING user → /advisor
```

### Sign Up with Email/Password

```
User fills registration form
         ↓
POST /api/auth/supabase/signup
         ↓
Backend creates:
  • Supabase Auth user
  • PostgreSQL user record
  • Cognitive profile (4 layers)
         ↓
Email confirmation sent (if enabled)
         ↓
User redirects to /login-supabase
```

### Login Flow

```
User enters credentials OR clicks OAuth
         ↓
Supabase authenticates
         ↓
Session token generated
         ↓
Frontend stores session (Supabase manages)
         ↓
ProtectedRoute checks: user || session
         ↓
Access granted → /advisor
```

### Logout Flow

```
User clicks "Logout"
         ↓
DashboardLayout.logout() called
         ↓
Clears Supabase session (API call)
Clears localStorage
Clears sessionStorage
         ↓
window.location.href = '/'
         ↓
Redirects to landing page
```

## Authentication Components

### Frontend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `SupabaseAuthContext.js` | `/app/frontend/src/context/` | Primary auth context, manages Supabase session |
| `AuthContext.js` | `/app/frontend/src/context/` | Legacy MongoDB auth context |
| `LoginSupabase.js` | `/app/frontend/src/pages/` | Login page with OAuth buttons |
| `RegisterSupabase.js` | `/app/frontend/src/pages/` | Registration page with OAuth |
| `AuthCallbackSupabase.js` | `/app/frontend/src/pages/` | OAuth callback handler |
| `Login.js` | `/app/frontend/src/pages/` | Legacy MongoDB login |
| `Register.js` | `/app/frontend/src/pages/` | Legacy MongoDB registration |

### Backend Modules

| Module | Location | Purpose |
|--------|----------|---------|
| `auth_supabase.py` | `/app/backend/` | Supabase auth functions |
| `supabase_client.py` | `/app/backend/` | Supabase client initialization |
| `server.py` | `/app/backend/` | Main FastAPI app (6,946 lines - monolithic) |

## Key Security Features

### Implemented
- ✅ Supabase JWT token validation
- ✅ OAuth consent flow
- ✅ Account picker (prevents silent auto-login)
- ✅ Confirmation dialog before OAuth redirect
- ✅ Session timeout handling
- ✅ Secure token storage (Supabase managed)

### Not Yet Implemented
- ❌ Row Level Security (RLS) policies
- ❌ Email confirmation
- ❌ Password reset
- ❌ Failed login attempt tracking
- ❌ Account lockout
- ❌ Two-factor authentication (2FA)
- ❌ Session management (active sessions view)

---

# 4. Database Schema

## Supabase PostgreSQL Tables

### users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    full_name TEXT,
    company_name TEXT,
    industry TEXT,
    role TEXT,
    subscription_tier TEXT DEFAULT 'free',
    is_master_account BOOLEAN DEFAULT FALSE,
    microsoft_user_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Indexes:**
- `idx_users_email` on email
- `idx_users_microsoft_user_id` on microsoft_user_id

**Purpose:** Core user identity and profile information

---

### cognitive_profiles
```sql
CREATE TABLE cognitive_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    immutable_reality JSONB DEFAULT '{}'::jsonb,
    behavioural_truth JSONB DEFAULT '{}'::jsonb,
    delivery_preference JSONB DEFAULT '{}'::jsonb,
    consequence_memory JSONB DEFAULT '{}'::jsonb,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);
```

**Purpose:** 4-layer Cognitive Core persistence
- **Layer 1 (Immutable Reality):** Business facts, unchanging data
- **Layer 2 (Behavioural Truth):** Observed actions, patterns
- **Layer 3 (Delivery Preference):** Communication style preferences
- **Layer 4 (Consequence Memory):** Outcomes of recommendations

---

### advisory_log
```sql
CREATE TABLE advisory_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    context JSONB DEFAULT '{}'::jsonb,
    confidence_score FLOAT,
    acted_upon BOOLEAN DEFAULT FALSE,
    outcome TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    outcome_recorded_at TIMESTAMP WITH TIME ZONE
);
```

**Purpose:** Track AI recommendations and their outcomes for learning

---

### soundboard_conversations
```sql
CREATE TABLE soundboard_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### soundboard_messages
```sql
CREATE TABLE soundboard_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES soundboard_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Purpose:** Conversation history for MySoundboard agent

---

### microsoft_tokens
```sql
CREATE TABLE microsoft_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_type TEXT DEFAULT 'Bearer',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scope TEXT,
    microsoft_user_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);
```

**Purpose:** Store Microsoft OAuth tokens for Outlook integration

---

## Row Level Security (RLS)

**Status:** ⚠️ ENABLED BUT NO POLICIES YET (CRITICAL SECURITY GAP!)

All tables have RLS enabled via:
```sql
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;
```

**Action Required:** Must add RLS policies before production deployment!

Example policy needed:
```sql
-- Users can only read their own data
CREATE POLICY "Users can view own data"
ON users FOR SELECT
USING (auth.uid() = id);

-- Similar policies needed for all tables
```

---

# 5. API Endpoints

## Supabase Auth Endpoints (New)

### POST /api/auth/supabase/signup
**Purpose:** Register new user with email/password

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepass123",
  "full_name": "John Doe",
  "company_name": "Acme Corp",
  "industry": "Technology",
  "role": "user"
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe"
  },
  "session": {
    "access_token": "eyJhbGc...",
    "refresh_token": "...",
    "expires_at": 1234567890
  }
}
```

---

### POST /api/auth/supabase/login
**Purpose:** Login with email/password

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepass123"
}
```

**Response:** Same as signup

---

### GET /api/auth/supabase/oauth/{provider}
**Purpose:** Get OAuth URL for Google or Azure

**Parameters:**
- `provider`: "google" or "azure"
- `redirect_to`: Optional redirect after auth

**Response:**
```json
{
  "url": "https://uxyqpdfftxpkzeppqtvk.supabase.co/auth/v1/authorize?provider=google",
  "provider": "google"
}
```

---

### GET /api/auth/supabase/me
**Purpose:** Get current authenticated user

**Headers:**
```
Authorization: Bearer {supabase_jwt_token}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user",
    "is_master_account": false,
    "subscription_tier": "free",
    "full_name": "John Doe",
    "company_name": "Acme Corp"
  }
}
```

---

## Legacy MongoDB Endpoints (To Be Deprecated)

- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

**Status:** Still active for backward compatibility, will be removed after full migration

---

# 6. Environment Configuration

## Backend Environment Variables (/app/backend/.env)

```bash
# MongoDB (Legacy - will be retired)
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"

# Supabase (Primary)
SUPABASE_URL=https://uxyqpdfftxpkzeppqtvk.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OAuth Configuration
GOOGLE_CLIENT_ID=903194754324-ife21qnmrokplbcu2ck5afce0kjd6j10.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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

AZURE_TENANT_ID=common
AZURE_TENANT_URL=https://login.microsoftonline.com/common
AZURE_CLIENT_ID=auth-revival-11
AZURE_CLIENT_SECRET=o8S8Q~3.q3nakGJkPOSZ.WkcdA0xsdNJUZ8Y5aVb

# AI Services
EMERGENT_LLM_KEY=sk-emergent-5Ba860e4dAbA4A7301
OPENAI_API_KEY=sk-proj-vEisusJarC_o4V7plhUG9kF8CpypZBlnVXgflEfdS5Ju...
SERPER_API_KEY=5b4733e54463108c9b410ef3d38074f667ee3e46

# URLs
BACKEND_URL=https://beta.thestrategysquad.com
FRONTEND_URL=https://beta.thestrategysquad.com

# Legacy
JWT_SECRET_KEY=strategic-advisor-secret-key-2024-secure
CORS_ORIGINS="*"
```

---

## Frontend Environment Variables (/app/frontend/.env)

```bash
REACT_APP_BACKEND_URL=https://beta.thestrategysquad.com
REACT_APP_GOOGLE_CLIENT_ID=903194754324-ife21qnmrokplbcu2ck5afce0kjd6j10.apps.googleusercontent.com

# Supabase
REACT_APP_SUPABASE_URL=https://uxyqpdfftxpkzeppqtvk.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# WebSocket
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
```

---

## Supabase Dashboard Configuration

### Project Details
- **Project Name:** The Strategy Squad aiV2
- **Project URL:** https://uxyqpdfftxpkzeppqtvk.supabase.co
- **Region:** (As configured during setup)

### Authentication Settings

**URL Configuration:**
- **Site URL:** `https://beta.thestrategysquad.com`
- **Redirect URLs:**
  - `https://beta.thestrategysquad.com/auth/callback`

**Providers Enabled:**
- ✅ Google OAuth
  - Client ID: 903194754324-ife21qnmrokplbcu2ck5afce0kjd6j10...
  - Client Secret: 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
  - Callback: https://uxyqpdfftxpkzeppqtvk.supabase.co/auth/v1/callback

- ✅ Azure/Microsoft OAuth
  - Tenant URL: https://login.microsoftonline.com/common
  - Client ID: 5d6e3cbb-cd88-4694-aa19-9b7115666866
  - Client Secret: o8S8Q~3.q3nakGJkPOSZ.WkcdA0xsdNJUZ8Y5aVb

---

# 7. Deployment Guide

## Current Environment

**Preview/Staging URL:**
```
https://beta.thestrategysquad.com
```

**Status:** Active and running
- Backend: Running on port 8001 (supervisor)
- Frontend: Running on port 3000 (supervisor)
- MongoDB: Running on port 27017 (supervisor)

## Service Management

### Check Service Status
```bash
sudo supervisorctl status
```

### Restart Services
```bash
# Restart backend
sudo supervisorctl restart backend

# Restart frontend
sudo supervisorctl restart frontend

# Restart all
sudo supervisorctl restart all
```

### View Logs
```bash
# Backend logs
tail -f /var/log/supervisor/backend.err.log
tail -f /var/log/supervisor/backend.out.log

# Frontend logs
tail -f /var/log/supervisor/frontend.err.log
tail -f /var/log/supervisor/frontend.out.log
```

## Deployment Checklist (Before Production)

### ⚠️ DO NOT DEPLOY TO PRODUCTION YET!

**Must Complete First:**
- [ ] Add RLS policies to all Supabase tables
- [ ] Test all auth methods (Google, Microsoft, Email/Password)
- [ ] Enable email confirmation in Supabase
- [ ] Implement password reset
- [ ] Test onboarding flow completely
- [ ] Update all protected pages to support Supabase
- [ ] Cross-browser testing
- [ ] Mobile testing
- [ ] Load testing
- [ ] Security audit
- [ ] Create rollback plan

**Estimated Timeline:** 1-2 weeks of testing before production

---

# 8. Testing Procedures

## Manual Testing Checklist

### Google OAuth Authentication

**Test Case 1: New User Sign Up**
1. Open incognito browser
2. Go to: https://beta.thestrategysquad.com/
3. Click "Start your free account"
4. Click "Continue with Google"
5. Verify confirmation dialog appears
6. Click "OK"
7. Verify Google account picker shows
8. Select account and approve
9. **Expected:** Redirect to /onboarding
10. Complete onboarding wizard
11. **Expected:** Redirect to /advisor
12. **Verify:** User appears in Supabase Auth → Users

**Test Case 2: Existing User Login**
1. Logout from dashboard
2. **Expected:** Redirect to landing page (/)
3. Click "Sign in"
4. Click "Continue with Google"
5. **Expected:** Account picker shows
6. Select same account
7. **Expected:** Skip onboarding, go directly to /advisor

---

### Microsoft OAuth Authentication

**Test Case 3: Microsoft Sign Up**
1. Open incognito browser
2. Go to registration page
3. Click "Continue with Microsoft"
4. Verify confirmation dialog
5. Verify Microsoft account picker
6. Select account and approve
7. **Expected:** Same flow as Google (onboarding → advisor)

---

### Email/Password Authentication

**Test Case 4: Email Registration**
1. Go to: /register-supabase
2. Fill in all fields (name, email, company, industry, password)
3. Click "Create account"
4. **Expected:** Success message, redirect to /login-supabase
5. Check email for confirmation (if enabled)

**Test Case 5: Email Login**
1. Go to: /login-supabase
2. Enter email and password
3. Click "Sign in"
4. **Expected:** Redirect to /advisor

---

### Logout Flow

**Test Case 6: Logout**
1. From any dashboard page
2. Click user menu → Logout
3. **Expected:** Redirect to landing page (/)
4. **Verify:** Console shows "Logout initiated... Logout complete..."
5. **Verify:** Can sign in again with any method

---

## Automated Testing

**Not Yet Implemented**

**Recommended Tools:**
- Playwright for E2E testing
- Jest for unit tests
- Cypress for integration tests

**Priority Test Suites Needed:**
1. Auth flow tests (all methods)
2. Protected route tests
3. API endpoint tests
4. Cognitive Core persistence tests

---

# 9. Troubleshooting Guide

## Common Issues

### Issue 1: White Screen After OAuth

**Symptoms:** User completes OAuth but sees blank screen

**Cause:** ProtectedRoute not recognizing Supabase session

**Solution:**
- Verify `ProtectedRoute` checks `user || session`
- Check browser console for auth errors
- Verify API client is sending Supabase token

**Fixed:** ✅ (as of latest update)

---

### Issue 2: 406 Errors on API Calls

**Symptoms:** API requests fail with 406 status

**Cause:** 
1. API client not sending Supabase token
2. Backend endpoint doesn't accept Supabase JWT
3. Missing RLS policies

**Solution:**
- Ensure `api.js` interceptor gets Supabase session
- Use Supabase endpoints (/api/auth/supabase/*)
- Add RLS policies to tables

**Fixed:** ✅ API client updated

---

### Issue 3: OAuth Buttons Not Showing

**Symptoms:** Login/register pages missing OAuth buttons

**Cause:** Navigating to old MongoDB pages (/login, /register) instead of new Supabase pages

**Solution:**
- Use `/login-supabase` and `/register-supabase` URLs
- Update all navigation links
- Clear browser cache

**Fixed:** ✅ Landing page links updated

---

### Issue 4: Infinite Redirect Loop After Login

**Symptoms:** Redirects between /login and /advisor repeatedly

**Cause:** 
- Session exists but user object is null
- ProtectedRoute only checking user, not session
- Profile fetch failing but no fallback

**Solution:**
- Update ProtectedRoute to check `user || session`
- Add fallback user creation from session
- Add error handling in auth context

**Fixed:** ✅

---

### Issue 5: Runtime Errors on Logout

**Symptoms:** Red error screen when logging out

**Cause:** 
- JSON parsing errors
- MongoDB logout failing
- Redirect happening before cleanup

**Solution:**
- Add try/catch in logout function
- Clear localStorage/sessionStorage
- Use setTimeout before redirect
- Force redirect even if API fails

**Fixed:** ✅

---

## Debug Commands

### Check Backend Logs
```bash
tail -n 100 /var/log/supervisor/backend.err.log
```

### Check Frontend Logs
```bash
tail -n 100 /var/log/supervisor/frontend.err.log
```

### Test Supabase Connection
```bash
cd /app/backend
python supabase_setup.py test
```

### List MongoDB Data
```bash
cd /app/backend
python list_users.py
```

### Check Service Status
```bash
sudo supervisorctl status
```

---

# 10. Outstanding Items & Roadmap

## Phase 1: Critical Migration Items (P0)

### A. Auth Flow Stabilization
- [ ] Test Microsoft OAuth end-to-end
- [ ] Test email/password registration
- [ ] Test email/password login
- [ ] Verify onboarding works for all auth methods
- [ ] Test logout → login cycle for all methods

### B. Security Hardening (CRITICAL!)
- [ ] Add RLS policies to all tables (users, cognitive_profiles, etc.)
- [ ] Enable email confirmation in Supabase
- [ ] Implement password reset flow
- [ ] Add failed login tracking
- [ ] Implement account lockout (5 failed attempts)

### C. Protected Pages Migration
- [ ] Update MyIntel page to support Supabase
- [ ] Update MySoundboard page
- [ ] Update BusinessProfile page
- [ ] Update Settings page
- [ ] Update Integrations page
- [ ] Update all other protected pages

### D. Link Auditing
- [ ] Audit all landing page CTAs
- [ ] Audit all internal navigation links
- [ ] Update "Sign in" links across app
- [ ] Update footer links
- [ ] Update email template links

---

## Phase 2: Security Features (P1)

### Email Verification
- [ ] Configure email templates in Supabase
- [ ] Test email confirmation flow
- [ ] Add "Resend confirmation" button
- [ ] Add "Email not verified" banner

### Password Management
- [ ] Create password reset page
- [ ] Configure reset email template
- [ ] Add password strength indicator
- [ ] Add password validation rules
- [ ] Test reset flow end-to-end

### Advanced Security
- [ ] Implement 2FA (TOTP)
- [ ] Add 2FA setup wizard
- [ ] Generate backup codes
- [ ] Session management dashboard
- [ ] Security audit logging

---

## Phase 3: Content & Design (P1)

### Landing Page Content
- [ ] Rewrite hero section (security focus)
- [ ] Add "Data Sovereignty" section
- [ ] Add "Unlock Hidden Data" section
- [ ] Add "Cognitive Core Learning" explainer
- [ ] Add security badges/certifications
- [ ] Add trust signals (privacy policy, terms)

### CTA Button Improvements
- [ ] Increase size (56px height)
- [ ] Add animations (hover, click)
- [ ] Improve copy ("Start Free Now")
- [ ] Add urgency indicators
- [ ] Ensure accessibility (WCAG AAA)
- [ ] Mobile optimization

### UI/UX Polish
- [ ] Fix dark mode toggle
- [ ] Improve dashboard layouts
- [ ] Better loading states
- [ ] Skeleton screens
- [ ] Error states
- [ ] Empty states

---

## Phase 4: Testing & QA (P1)

- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile testing (iOS, Android)
- [ ] Accessibility audit
- [ ] Performance testing
- [ ] Load testing
- [ ] Security penetration testing

---

## Phase 5: MongoDB Retirement (P2)

- [ ] Verify all features work with Supabase
- [ ] Export MongoDB data (archive)
- [ ] Remove MongoDB auth endpoints
- [ ] Remove MongoDB dependencies
- [ ] Remove AuthContext.js (legacy)
- [ ] Remove Login.js and Register.js (old pages)
- [ ] Stop MongoDB service

---

## Phase 6: Production Deployment (After All Above)

- [ ] Create deployment runbook
- [ ] Plan maintenance window
- [ ] Create rollback procedure
- [ ] Update DNS/URLs if needed
- [ ] Monitor for issues
- [ ] User communication plan

---

# 11. Key Contacts & Resources

## Supabase Project
- **Dashboard:** https://supabase.com/dashboard
- **Project:** The Strategy Squad aiV2
- **Documentation:** https://supabase.com/docs

## Google Cloud Console
- **Console:** https://console.cloud.google.com/
- **OAuth Client ID:** 903194754324-ife21qnmrokplbcu2ck5afce0kjd6j10

## Azure Portal
- **Portal:** https://portal.azure.com/
- **App Registration:** Strategy Squad Auth

## Application URLs
- **Preview:** https://beta.thestrategysquad.com
- **Login (New):** /login-supabase
- **Register (New):** /register-supabase

---

# 12. Known Issues & Limitations

## Current Known Issues

### Critical
1. **No RLS policies** - Anyone with direct database access could read/modify data
2. **No email confirmation** - Users can access app without verified email
3. **No password reset** - Users with forgotten passwords cannot recover accounts

### High Priority
4. **Not all pages support Supabase auth** - Some features may break for Supabase users
5. **Dark mode toggle broken** - UI_P2_001
6. **Placeholder integration buttons** - Non-functional in Integrations page

### Medium Priority
7. **Dual auth system** - Confusing to have both MongoDB and Supabase
8. **No failed login tracking** - Cannot detect brute force attempts
9. **No 2FA** - Additional security layer missing

---

# 13. Success Metrics

## Target Metrics (Post-Full Migration)

### Authentication
- OAuth conversion rate: >60%
- Email confirmation rate: >80%
- Onboarding completion: >70%
- Login success rate: >95%
- Failed login rate: <5%

### Security
- Zero security incidents
- 100% email verification (when enforced)
- 2FA adoption: >30%
- Account lockouts: <1% of users

### User Experience
- Time to first login: <2 minutes
- Landing page bounce rate: <40%
- CTA click-through: >15%
- Mobile conversion: >50% of desktop

---

# 14. Appendix

## File Structure

```
/app/
├── backend/
│   ├── server.py (6,946 lines - monolithic)
│   ├── cognitive_core.py
│   ├── auth_supabase.py (NEW)
│   ├── supabase_client.py (NEW)
│   ├── supabase_setup.py (migration script)
│   ├── .env
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   │   ├── SupabaseAuthContext.js (NEW)
│   │   │   └── AuthContext.js (LEGACY)
│   │   ├── pages/
│   │   │   ├── LoginSupabase.js (NEW)
│   │   │   ├── RegisterSupabase.js (NEW)
│   │   │   ├── AuthCallbackSupabase.js (NEW)
│   │   │   ├── Login.js (LEGACY)
│   │   │   ├── Register.js (LEGACY)
│   │   │   ├── Advisor.js (UPDATED)
│   │   │   ├── OnboardingWizard.js (UPDATED)
│   │   │   └── [other pages...]
│   │   ├── components/
│   │   │   ├── DashboardLayout.js (UPDATED)
│   │   │   └── ui/ (shadcn components)
│   │   ├── lib/
│   │   │   └── api.js (UPDATED - supports Supabase tokens)
│   │   ├── App.js (UPDATED)
│   │   └── index.css
│   ├── .env
│   └── package.json
│
├── TODO_CHECKLIST.md (Master task list)
└── OPERATIONS_MANUAL.md (This document)
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 15, 2026 | Initial operations manual created. OAuth working, onboarding fixed, API client updated. |

---

# Document End

**For Questions or Support:**
- Refer to TODO_CHECKLIST.md for task tracking
- Check browser console for auth debugging
- Review Supabase dashboard for user/auth issues
- Contact: andre@thestrategysquad.com.au
