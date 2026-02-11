# BIQC ROUTE CLASSIFICATION REPORT
## Date: February 11, 2026
## Classification: Observation Only — Nothing Deleted

---

## SUMMARY

| Category | Count | Description |
|----------|-------|-------------|
| **A — Active Production** | 85 | Referenced by frontend or used internally by intelligence pipeline |
| **B — Parked / Future Capability** | 30 | Intentional features not yet surfaced in UI |
| **C — True Dead Code** | 12 | Unreferenced, undocumented, no clear purpose |
| **Total** | 127 | |

---

## CATEGORY A — ACTIVE PRODUCTION (85 routes)

These routes are called by the frontend or are essential backend infrastructure.

### Core Platform
| Method | Path | Source | Notes |
|--------|------|--------|-------|
| GET | `/` | server.py | Root/health |
| GET | `/health` | server.py | Health check |

### Auth (7)
| GET | `/auth/supabase/me` | server.py | User profile — used by ProtectedRoute admin check |
| GET | `/auth/check-profile` | server.py | OAuth callback profile check |
| GET | `/auth/outlook/login` | server.py | Outlook OAuth initiation |
| GET | `/auth/outlook/callback` | server.py | Outlook OAuth callback |
| GET | `/auth/gmail/login` | server.py | Gmail OAuth initiation |
| GET | `/auth/gmail/callback` | server.py | Gmail OAuth callback |
| GET | `/calibration/status` | server.py | Calibration authority check |

### Calibration (3)
| POST | `/calibration/brain` | server.py | War Room — Strategic Console |
| POST | `/calibration/init` | server.py | Initialize calibration session |
| POST | `/calibration/answer` | server.py | Legacy 9-step calibration answer |

### Onboarding (3)
| GET | `/onboarding/status` | server.py | Onboarding completion check |
| POST | `/onboarding/save` | server.py | Save onboarding progress |
| POST | `/onboarding/complete` | server.py | Mark onboarding complete |

### Intelligence Pipeline (10)
| POST | `/watchtower/emit` | routes/watchtower.py | Emit observation event |
| POST | `/watchtower/analyse` | routes/watchtower.py | Trigger analysis cycle |
| GET | `/watchtower/positions` | routes/watchtower.py | Domain positions |
| GET | `/watchtower/findings` | routes/watchtower.py | Historical findings |
| POST | `/boardroom/respond` | routes/boardroom.py | Board Room response |
| POST | `/boardroom/escalation-action` | routes/boardroom.py | Acknowledge/defer risk |
| GET | `/baseline` | routes/intelligence.py | Read intelligence baseline |
| POST | `/baseline` | routes/intelligence.py | Save intelligence baseline |
| GET | `/snapshot/latest` | routes/intelligence.py | Latest snapshot |
| POST | `/intelligence/cold-read` | server.py | Watchtower cold read |

### Fact Authority (2)
| GET | `/facts/resolve` | routes/facts.py | Resolve all known facts |
| POST | `/facts/confirm` | routes/facts.py | Confirm a fact |

### Business Profile (5)
| GET | `/business-profile` | server.py | Read profile |
| PUT | `/business-profile` | server.py | Update profile |
| POST | `/business-profile/build` | server.py | Build from documents |
| GET | `/business-profile/context` | server.py | Context with resolved fields |
| GET | `/business-profile/scores` | server.py | Profile completeness |

### Chat (1)
| POST | `/chat` | server.py | AI chat |

### SoundBoard (5)
| POST | `/soundboard/chat` | server.py | SoundBoard chat |
| GET | `/soundboard/conversations` | server.py | List conversations |
| GET | `/soundboard/conversations/{id}` | server.py | Get conversation |
| PATCH | `/soundboard/conversations/{id}` | server.py | Rename conversation |
| DELETE | `/soundboard/conversations/{id}` | server.py | Delete conversation |

### Integrations (6)
| GET | `/integrations/merge/connected` | server.py | List connected integrations |
| POST | `/integrations/merge/exchange-account-token` | server.py | Exchange token |
| POST | `/integrations/merge/link-token` | server.py | Get link token |
| GET | `/integrations/crm/deals` | server.py | CRM deals |
| POST | `/gmail/disconnect` | server.py | Disconnect Gmail |
| POST | `/outlook/disconnect` | server.py | Disconnect Outlook |

### Email/Calendar (8)
| GET | `/outlook/status` | server.py | Outlook connection status |
| GET | `/outlook/emails/sync` | server.py | Sync emails |
| GET | `/outlook/intelligence` | server.py | Email intelligence |
| GET | `/outlook/calendar/events` | server.py | Calendar events |
| POST | `/outlook/calendar/sync` | server.py | Sync calendar |
| GET | `/email/priority-inbox` | server.py | Priority inbox |
| POST | `/email/suggest-reply/{id}` | server.py | Suggest reply |
| GET | `/intelligence/watchtower` | server.py | V1 watchtower events |

### Data Center (4)
| POST | `/data-center/upload` | server.py | Upload file |
| GET | `/data-center/files` | server.py | List files |
| GET | `/data-center/files/{id}` | server.py | Get file |
| DELETE | `/data-center/files/{id}` | server.py | Delete file |

### Admin (4)
| GET | `/admin/users` | routes/admin.py | List users |
| GET | `/admin/stats` | routes/admin.py | Platform stats |
| PUT | `/admin/users/{id}` | routes/admin.py | Update user |
| DELETE | `/admin/users/{id}` | routes/admin.py | Delete user |

### Other Active (11)
| GET | `/analyses` | server.py | List analyses |
| POST | `/analyses` | server.py | Create analysis |
| GET | `/analyses/{id}` | server.py | Get analysis |
| DELETE | `/analyses/{id}` | server.py | Delete analysis |
| POST | `/diagnose` | server.py | Business diagnosis |
| GET | `/diagnoses` | server.py | List diagnoses |
| POST | `/generate/sop` | server.py | Generate SOP |
| POST | `/generate/checklist` | server.py | Generate checklist |
| POST | `/generate/action-plan` | server.py | Generate action plan |
| GET | `/notifications/alerts` | server.py | Get notifications |
| GET | `/oac/recommendations` | server.py | OAC recommendations |
| POST | `/website/enrich` | server.py | Website metadata |
| GET | `/dashboard/stats` | server.py | Dashboard statistics |
| GET | `/dashboard/focus` | server.py | Dashboard focus areas |
| GET | `/documents` | server.py | List documents |
| POST | `/documents` | server.py | Create document |
| GET | `/documents/{id}` | server.py | Get document |
| PUT | `/documents/{id}` | server.py | Update document |
| DELETE | `/documents/{id}` | server.py | Delete document |
| GET | `/data-center/stats` | server.py | Data center stats |

---

## CATEGORY B — PARKED / FUTURE CAPABILITY (30 routes)

These routes are functional but not yet surfaced in the current UI. They serve known roadmap features.

### Intelligence Pipeline (Backend-only triggers)
| Method | Path | Source | Roadmap Purpose |
|--------|------|--------|-----------------|
| POST | `/emission/run` | routes/intelligence.py | Scheduled integration signal emission (needs cron) |
| POST | `/snapshot/generate` | routes/intelligence.py | Scheduled snapshot generation (needs cron) |
| GET | `/snapshot/history` | routes/intelligence.py | Snapshot audit trail |
| POST | `/watchtower/analyse` | routes/watchtower.py | Scheduled analysis (needs cron) |
| POST | `/watchtower/emit` | routes/watchtower.py | Programmatic signal emission |
| PATCH | `/intelligence/watchtower/{id}/handle` | server.py | Mark watchtower event handled |

### Cognitive Core API (Internal AI subsystem)
| GET | `/advisory/confidence` | server.py | AI confidence scores |
| GET | `/advisory/escalations` | server.py | Escalation history |
| GET | `/advisory/history` | server.py | Advisory recommendations |
| POST | `/advisory/log` | server.py | Log advisory recommendation |
| POST | `/advisory/outcome` | server.py | Record recommendation outcome |
| GET | `/cognitive/escalation` | server.py | Cognitive escalation state |
| POST | `/cognitive/observe` | server.py | Record observation |
| GET | `/cognitive/profile` | server.py | Read cognitive profile |
| POST | `/cognitive/sync-business-profile` | server.py | Sync business profile to cognitive core |

### Enterprise Features (Invite system)
| POST | `/account/users/invite` | server.py | Invite team member |
| POST | `/account/users/accept` | server.py | Accept team invite |

### Integration Data Access (Merge CRM)
| GET | `/integrations/crm/contacts` | server.py | CRM contacts (needs UI page) |
| GET | `/integrations/crm/companies` | server.py | CRM companies (needs UI page) |
| GET | `/integrations/crm/owners` | server.py | CRM owners (needs UI page) |

### Google Drive Integration
| POST | `/integrations/google-drive/connect` | server.py | Connect Google Drive |
| POST | `/integrations/google-drive/callback` | server.py | OAuth callback |
| GET | `/integrations/google-drive/files` | server.py | List files |
| GET | `/integrations/google-drive/status` | server.py | Connection status |
| POST | `/integrations/google-drive/sync` | server.py | Sync files |

### Versioned Profile System
| GET | `/business-profile/versioned` | server.py | Read versioned profile |
| GET | `/business-profile/history` | server.py | Profile version history |
| POST | `/business-profile/request-update` | server.py | Request profile update |

### Admin Tools
| PUT | `/admin/users/{id}/subscription` | server.py | Manage subscriptions |
| POST | `/admin/backfill-calibration` | routes/admin.py | One-time migration tool |

### Auth Infrastructure
| POST | `/auth/supabase/signup` | server.py | Direct signup API |
| POST | `/auth/supabase/login` | server.py | Direct login API |
| GET | `/auth/supabase/oauth/{provider}` | server.py | OAuth URL generator |

---

## CATEGORY C — TRUE DEAD CODE CANDIDATES (12 routes)

These routes have no frontend reference, no documented roadmap purpose, and appear to be development artifacts or superseded functionality.

| Method | Path | Source | Reason |
|--------|------|--------|--------|
| GET | `/calibration/activation` | server.py | Legacy activation check — superseded by `/calibration/status`. Returns hardcoded data. |
| POST | `/calibration/defer` | server.py | Writes to `user_operator_profile` but the auth gate doesn't recognize `deferred` as a valid pass-through state. Never called by frontend. |
| GET | `/chat/history` | server.py | Legacy chat history endpoint — not used by any frontend page. Chat is session-based. |
| GET | `/chat/sessions` | server.py | Legacy chat sessions list — not used by any frontend page. |
| POST | `/email/analyze-priority` | server.py | Email priority analysis — superseded by priority-inbox. No frontend caller. |
| GET | `/gmail/status` | server.py | Gmail status check — not called by any frontend page (Integrations page uses `/outlook/status` for email). |
| GET | `/baseline/defaults` | routes/intelligence.py | Default baseline — only used internally by `/baseline` GET. Could be merged. |
| POST | `/outlook/comprehensive-sync` | server.py | Comprehensive email sync — superseded by `/outlook/emails/sync`. Not called by frontend. |
| GET | `/outlook/debug-tokens` | server.py | Debug endpoint for OAuth tokens. Development artifact. |
| GET | `/outlook/sync-status/{job_id}` | server.py | Sync job status check — background job monitoring. Not called by frontend. |
| POST | `/strategy/regeneration/request` | server.py | Strategy regeneration — feature not launched. No frontend UI. |
| POST | `/strategy/regeneration/response` | server.py | Strategy regeneration response — same as above. |
| GET | `/data-center/categories` | server.py | List file categories — not called by frontend DataCenter page. |
| GET | `/data-center/files/{id}/download` | server.py | Download file — not called by frontend. |
| POST | `/business-profile/autofill` | server.py | AI autofill from documents — superseded by `/business-profile/build`. |
| POST | `/notifications/dismiss/{id}` | server.py | Dismiss notification — notifications polling is disabled (ENABLE_NOTIFICATIONS_POLLING = false). |

---

## FRONTEND PAGE CLASSIFICATION

Pages in App.js with NO sidebar navigation:

| Route | Page | Category |
|-------|------|----------|
| `/onboarding` | OnboardingWizard | A — Onboarding flow |
| `/onboarding-decision` | OnboardingDecision | A — Onboarding flow |
| `/calibration` | CalibrationAdvisor | A — Calibration flow |
| `/profile-import` | ProfileImport | B — Parked feature |
| `/admin` | AdminDashboard | A — Admin (intentionally hidden) |
| `/advisor-legacy` | Advisor | C — Superseded by AdvisorWatchtower |
| `/oac` | OpsAdvisoryCentre | C — Legacy operations page |
| `/intel-centre` | IntelCentre | C — Superseded by Board Room |
| `/outlook-test` | OutlookTest | C — Development test page |
| `/gmail-test` | GmailTest | C — Development test page |
| `/diagnosis` | Diagnosis | B — UI exists but no sidebar link |
| `/analysis` | Analysis | B — UI exists but no sidebar link |
| `/market-analysis` | MarketAnalysis | B — UI exists but no sidebar link |
| `/sop-generator` | SOPGenerator | B — UI exists but no sidebar link |
| `/data-center` | DataCenter | B — UI exists but no sidebar link |
| `/documents` | Documents | B — UI exists but no sidebar link |
| `/email-inbox` | EmailInbox | B — UI exists but no sidebar link |
| `/watchtower` | Watchtower (V1) | C — Superseded by V2 routes |

---

## RECOMMENDED ACTIONS (Not Implemented)

1. **Category C backend routes**: Add deprecation comments. Consider removal in next cleanup sprint.
2. **Category C frontend pages**: Remove from App.js router (4 pages: advisor-legacy, oac, intel-centre, outlook-test, gmail-test, watchtower V1).
3. **Category B routes**: Keep but add `@deprecated` or `# PARKED` comments for clarity.
4. **Category B pages**: Consider adding sidebar links for diagnosis, analysis, data-center, documents, email-inbox.

---

## END OF CLASSIFICATION

Nothing deleted. Nothing modified. Classification only.
