# BIQc Schema Reference — Tables, Columns & Usage

## Core Tables

### `users`
| Column | Type | Usage |
|--------|------|-------|
| id | uuid (PK) | Supabase auth user ID |
| email | text | User email |
| full_name | text | Display name |
| company_name | text | From signup metadata |
| industry | text | From signup metadata |
| role | text | user/admin/superadmin |
| subscription_tier | text | free/professional/enterprise |
| account_id | uuid (FK) | Links to accounts table |
| is_master_account | boolean | Owner flag |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `business_profiles`
| Column | Type | Usage |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid (FK→users) | |
| account_id | uuid (FK→accounts) | |
| business_name | text | Strategic Dimension #1 |
| business_stage | text | Strategic Dimension #2 |
| industry | text | Strategic Dimension #3 |
| location | text | Strategic Dimension #4 |
| target_market | text | Strategic Dimension #5 |
| products_services | text | Strategic Dimension #6 |
| unique_value_proposition | text | Strategic Dimension #7 |
| team_size | text | Strategic Dimension #8 |
| years_operating | text | Strategic Dimension #9 |
| short_term_goals | text | Strategic Dimension #10 |
| long_term_goals | text | Strategic Dimension #11 |
| main_challenges | text | Strategic Dimension #12 |
| growth_strategy | text | Strategic Dimension #13 |
| growth_goals | text | Strategic Dimension #14 |
| risk_profile | text | Strategic Dimension #15 |
| competitive_advantages | text | Strategic Dimension #16 |
| business_model | text | Strategic Dimension #17 |
| website | text | |
| abn | text | |
| calibration_status | text | complete/in_progress/deferred |
| social_handles | jsonb | LinkedIn, Twitter, etc. |
| intelligence_configuration | jsonb | Domain configs |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `strategic_console_state`
| Column | Type | Usage |
|--------|------|-------|
| user_id | uuid (PK) | |
| status | text | COMPLETED/IN_PROGRESS |
| current_step | int | 1-17 |
| is_complete | boolean | Authoritative routing flag |
| updated_at | timestamptz | |

### `user_operator_profile`
| Column | Type | Usage |
|--------|------|-------|
| user_id | uuid (PK) | |
| persona_calibration_status | text | complete/incomplete/recalibrating/deferred |
| calibration_completed_at | timestamptz | |
| operator_profile | jsonb | Contains: console_state, onboarding_state, fact_ledger |
| agent_persona | jsonb | AI persona configuration |
| agent_instructions | text | Custom AI instructions |
| updated_at | timestamptz | |

### `strategy_profiles`
| Column | Type | Usage |
|--------|------|-------|
| id | uuid (PK) | |
| business_profile_id | uuid (FK) | |
| user_id | uuid (FK) | |
| account_id | uuid (FK) | |
| raw_mission_input | text | User's raw input |
| raw_vision_input | text | |
| raw_goals_input | text | |
| raw_challenges_input | text | |
| raw_growth_input | text | |
| mission_statement | text | AI-refined |
| vision_statement | text | AI-refined |
| short_term_goals | text | AI-refined |
| long_term_goals | text | AI-refined |
| primary_challenges | text | AI-refined |
| growth_strategy | text | AI-refined |
| source | text | user/ai_generated |
| regenerable | boolean | |

### `cognitive_profiles`
| Column | Type | Usage |
|--------|------|-------|
| user_id | uuid (PK) | |
| immutable_reality | jsonb | Core personality traits |
| behavioural_truth | jsonb | Decision patterns |
| delivery_preference | jsonb | Communication style |
| consequence_memory | jsonb | Past outcomes |
| last_updated | timestamptz | |

## Intelligence Tables

### `intelligence_baseline` — Domain monitoring config
### `intelligence_actions` — User [Read/Action/Ignore] on briefs
### `intelligence_priorities` — Signal category rankings
### `intelligence_snapshots` — Point-in-time snapshots
### `watchtower_insights` — Generated intelligence briefs
### `watchtower_events` — Raw signal events
### `observation_events` — Integration-derived observations
### `escalation_memory` — Escalation tracking
### `contradiction_memory` — Detected contradictions
### `decision_pressure` — Decision window tracking
### `evidence_freshness` — Data staleness tracking

## Integration Tables

### `integration_accounts` — Merge.dev + direct connections
### `merge_integrations` — Merge.dev account tokens
### `gmail_connections` — Gmail OAuth tokens
### `outlook_oauth_tokens` — Outlook/M365 tokens
### `m365_tokens` — Microsoft 365 tokens
### `google_drive_files` — Synced Drive file metadata

## Content Tables

### `documents` — User-uploaded documents
### `data_files` — Imported data files
### `sops` — Generated Standard Operating Procedures
### `soundboard_conversations` — AI conversation history
### `chat_history` — BIQc Insights chat history
### `analyses` — Generated business analyses
### `diagnoses` — Generated business diagnoses

## Routing Authority (Priority Order)
1. `strategic_console_state.is_complete = true` → User is CALIBRATED
2. `user_operator_profile.persona_calibration_status = 'complete'` → Fallback
3. Everything else → NEEDS_CALIBRATION
