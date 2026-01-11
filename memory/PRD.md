# The Strategy Squad - Product Requirements Document

## Original Problem Statement
Transform "The Strategy Squad" application into a hyper-personalized, "virtually human-like" AI business advisor with:
- Smart multi-step onboarding questionnaire
- Business Profile Completeness and dynamic Business Score
- Hyper-personalization with three AI personas: MySoundboard, Chief Business Advisor, Execution Coach
- Deep integration with business tools (priority: Microsoft Outlook)
- Priority Inbox, Calendar Intelligence, ChatGPT-style chat interface
- Voice Chat functionality (video-call-like experience)

## User Personas
- Small business owners seeking strategic advice
- Entrepreneurs needing accountability and execution coaching
- Business advisors using the platform for client management

## Core Requirements
1. **Authentication**: Email/password + Google OAuth
2. **Business Profile**: Comprehensive profile builder with completeness scoring
3. **AI Advisory Team**: Three distinct AI personas
4. **Microsoft Outlook Integration**: Email and calendar sync for AI context
5. **Chat Interface**: MySoundBoard with conversation history
6. **Voice Chat**: Real-time voice interaction

---

## What's Been Implemented

### Completed Features ✅
- [x] User authentication (email/password + Google OAuth)
- [x] Business profile management with completeness scoring
- [x] Microsoft Outlook OAuth integration (FIXED - Jan 10, 2025)
- [x] AI-powered chat (MySoundBoard, Chief Business Advisor personas)
- [x] Navigation restructure (Advisory Team, Agent IQ Builder)
- [x] Smart notifications system (backend + UI badges)
- [x] Dashboard Focus AI feature
- [x] Voice Chat with OpenAI Realtime API (Jan 10, 2025)
- [x] Mobile responsive design improvements (Jan 10, 2025)

### Security Fixes (Jan 10, 2025) ✅
- [x] HMAC-signed OAuth state parameter (CSRF protection)
- [x] Security audit logging for Outlook connections
- [x] Connected Microsoft email tracking and display
- [x] Disconnect endpoint with full data cleanup
- [x] `prompt=select_account` for Microsoft account picker
- [x] User warning when Microsoft email differs from account email

### Voice Chat Implementation (Jan 10, 2025) ✅
- [x] OpenAI Realtime Voice API integration
- [x] WebRTC-based real-time voice conversation
- [x] Visual speaking indicators
- [x] Transcript panel
- [x] Mobile-responsive voice UI

---

## Prioritized Backlog

### P0 - Critical
- [ ] Email Intelligence backend implementation
- [ ] Calendar Intelligence backend implementation

### P1 - High Priority
- [ ] Business Profile immutable versioned API frontend update
- [ ] Execution Coach AI persona
- [ ] Custom voice chat persona for MySoundBoard

### P2 - Medium Priority
- [ ] Dark/light mode toggle fix
- [ ] Placeholder integration buttons "Coming Soon" state

### P3 - Low Priority / Future
- [ ] Settings & Billing Section
- [ ] User Seat Management & Invite Flow
- [ ] Feature Gating for subscription tiers
- [ ] WhatsApp, SMS, HubSpot, Xero, LinkedIn integrations
- [ ] PDF Export

---

## Technical Architecture

### Backend
- FastAPI (Python)
- MongoDB
- OpenAI GPT-4o via Emergent LLM Key
- OpenAI Realtime Voice API (direct key)
- Microsoft Graph API for Outlook

### Frontend
- React
- Shadcn/UI components
- Tailwind CSS
- WebRTC for voice chat

### Key Files
- `/app/backend/server.py` - Main API with voice chat routes
- `/app/frontend/src/pages/MySoundBoard.js` - Chat interface
- `/app/frontend/src/components/VoiceChat.js` - Voice chat component
- `/app/frontend/src/pages/Integrations.js` - Tool connections

---

## 3rd Party Integrations
- OpenAI GPT-4o (Emergent LLM Key) - Text chat
- OpenAI Realtime Voice API (User key) - Voice chat
- Microsoft Graph API (User credentials) - Outlook
- Serper.dev for web search (User API Key)

---

*Last Updated: January 10, 2025*
