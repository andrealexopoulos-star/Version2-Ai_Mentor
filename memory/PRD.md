# BIQc Platform — Product Requirements Document

## Original Problem Statement
Transform BIQc into a high-performance, AI-driven "Cognition-as-a-Platform" for SMBs. Complete visual and architectural overhaul to a "Liquid Steel" dark theme with premium typography (Cormorant Garamond + Inter).

## Core Requirements
- Premium "Liquid Steel" aesthetic (dark theme #0F1720 background, orange #FF6A00 accents)
- Fast, intuitive, agentic user experience
- Industry-contextualized intelligence
- Enterprise-grade Super Admin portal
- Successful deployment to production

## Architecture
- **Frontend**: React (CRA + CRACO) with Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: Supabase (PostgreSQL, Auth, Edge Functions, pg_cron)
- **AI**: OpenAI + Perplexity via Supabase Edge Functions
- **Integrations**: Merge.dev (CRM/Accounting), Google/Microsoft OAuth

## What's Been Implemented

### 2026-02-23: Route Migration Fix (CRITICAL)
- **ROOT CAUSE FOUND**: Liquid Steel themed pages were built under `/site/*` routes but main routes (`/`, `/pricing`, `/trust`) still served OLD light-themed components
- **FIX**: Swapped all main routes to use Liquid Steel components, updated WebsiteLayout.js and PlatformLayout.js navigation links, added `/site/*` → `/` redirects
- **Testing**: 20/20 frontend tests PASSED (100% success rate)
- **Status**: ✅ COMPLETE — Root URL now serves Liquid Steel theme

### Previous Session: Complete UI/UX Transformation
- Redesigned 65+ pages/components to Liquid Steel dark theme
- Built 8-section Super Admin portal
- Created architectural planning documents
- Fixed deployment code-level blockers
- Font & legibility audits completed

## Route Structure (Current)
### Public Pages (Liquid Steel)
- `/` → Homepage
- `/platform` → Platform overview
- `/intelligence` → Intelligence overview
- `/our-integrations` → Integrations overview
- `/pricing` → Pricing
- `/trust` → Trust landing
- `/trust/terms`, `/trust/privacy`, `/trust/dpa`, `/trust/security`, `/trust/centre`
- `/contact` → Contact page

### Auth Pages (Liquid Steel)
- `/login-supabase` → Login
- `/register-supabase` → Register
- `/auth/callback` → OAuth callback

### Protected Platform Pages
- `/advisor` → Main dashboard (AdvisorWatchtower)
- `/business-profile`, `/oac`, `/intel-centre`, `/diagnosis`, `/analysis`
- `/settings`, `/integrations`, `/email-inbox`, `/calendar`, `/soundboard`
- `/admin` → Super Admin portal

### Demo/Mockup Pages
- `/platform/login`, `/platform/overview`, `/platform/revenue`, `/platform/alerts`
- `/platform/industry/msp`, `/platform/industry/construction`, etc.

## Pending Tasks

### P0
- Production deployment verification — user must use "Save to GitHub" → "Deploy"
- If MongoDB migration error persists, contact Emergent support to change template

### P1
- Implement "Soundboard" capability
- Recover 5 missing Edge Function source files
- Full post-deployment E2E testing

### P2
- Build Action Layer backend (email/SMS/ticketing)
- Implement Blueprint features (SOP Generator, Vision Generator)
- Refactor legacy backend to Edge Functions

### Backlog
- Consolidate duplicate Supabase secrets
- Add Merge.dev webhook handler
- Clean up old mockup pages
