# The Strategy Squad - Product Requirements Document

## Original Problem Statement
Transform "The Strategy Squad" application into a hyper-personalized, "virtually human-like" AI business advisor with:
- Per-User Cognitive Core (persistent intelligence layer)
- Three distinct AI agents with enforced output shapes
- Smart multi-step onboarding questionnaire
- Business Profile Completeness and dynamic Business Score
- Deep integration with business tools (priority: Microsoft Outlook)
- Priority Inbox, Calendar Intelligence, ChatGPT-style chat interface
- Voice Chat functionality (video-call-like experience)

## Agent Constitution v1.0

### Three Agents (Fixed, Non-Negotiable):
1. **MyIntel** - Surfaces intelligence (Headline → Fact → Implication)
2. **MyAdvisor** - Directs action (Situation → Decision → Next step)  
3. **MySoundboard** - Thinking partner (Observation → Question)

### Cognitive Core (Per-User):
Four layers of persistent user understanding:
- Layer 1: Immutable Reality Model
- Layer 2: Behavioural Truth Model
- Layer 3: Delivery Preference Model
- Layer 4: Consequence & Outcome Memory

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
- [x] **Per-User Cognitive Core (Jan 10, 2025)**
- [x] **MySoundboard Agent Constitution compliance (Jan 10, 2025)**

### Cognitive Core Implementation (Jan 10, 2025) ✅
- [x] Four-layer persistent user profile
- [x] Passive continuous learning
- [x] Integration with MySoundboard
- [x] Business profile sync to reality model
- [x] Observation recording API

---

## Prioritized Backlog

### P0 - Critical
- [ ] MyAdvisor Cognitive Core + Agent Constitution compliance
- [ ] MyIntel Cognitive Core + Agent Constitution compliance
- [ ] Notification state machine implementation
- [ ] Email Intelligence backend implementation
- [ ] Calendar Intelligence backend implementation

### P1 - High Priority
- [ ] Business Profile immutable versioned API frontend update
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
- **Cognitive Core** - Per-user intelligence layer
- OpenAI GPT-4o via Emergent LLM Key
- OpenAI Realtime Voice API (direct key)
- Microsoft Graph API for Outlook

### Frontend
- React
- Shadcn/UI components
- Tailwind CSS
- WebRTC for voice chat

### Key Files
- `/app/backend/cognitive_core.py` - Per-User Cognitive Core
- `/app/backend/server.py` - Main API with agent endpoints
- `/app/frontend/src/pages/MySoundBoard.js` - Chat interface
- `/app/frontend/src/components/VoiceChat.js` - Voice chat component

---

## 3rd Party Integrations
- OpenAI GPT-4o (Emergent LLM Key) - Text chat
- OpenAI Realtime Voice API (User key) - Voice chat
- Microsoft Graph API (User credentials) - Outlook
- Serper.dev for web search (User API Key)

---

*Last Updated: January 10, 2025*
