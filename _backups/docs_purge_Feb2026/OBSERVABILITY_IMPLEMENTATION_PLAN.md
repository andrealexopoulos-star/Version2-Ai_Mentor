# MINIMUM OBSERVABILITY BASELINE - IMPLEMENTATION PLAN
**PROMPT 1 - Task 3**

## OBJECTIVE

Add error monitoring WITHOUT external dependencies (Sentry requires signup/payment).

Use built-in Python logging + structured error tracking.

---

## APPROACH: FILE-BASED ERROR TRACKING

**Why:**
- No external service signup required
- No additional costs
- PII-safe (we control what's logged)
- Can export to Sentry later

---

## IMPLEMENTATION

### 1. Enhanced Logging Configuration

**File:** `/app/backend/error_monitor.py` (NEW)

**Features:**
- Structured JSON logging
- Error categorization
- PII filtering
- Rotation policy

### 2. Error Categories

- `AUTH_ERROR`: Login failures, token expiry
- `INTEGRATION_ERROR`: Outlook/Gmail/Merge.dev failures
- `DATABASE_ERROR`: MongoDB/Supabase failures
- `API_ERROR`: External API failures
- `VALIDATION_ERROR`: Input validation failures

### 3. Log Storage

**Location:** `/var/log/biqc/errors.jsonl`
**Format:** JSON Lines (one error per line)
**Rotation:** 10MB max size, keep last 5 files
**Retention:** 30 days

### 4. PII Safety

**Filter:**
- Email addresses → `[email-redacted]`
- Tokens → `[token-redacted-{first8chars}]`
- IP addresses → `[ip-redacted]`
- Keep: user_id, error type, timestamp, stack trace (sanitized)

---

## MONITORING DASHBOARD (Simple)

**Endpoint:** `GET /api/admin/errors` (admin-only)

**Returns:**
- Last 100 errors
- Grouped by category
- Count by error type

**Frontend component:** Simple table in Settings → Admin

---

## IMPLEMENTATION STEPS

1. Create `/app/backend/error_monitor.py`
2. Add logging middleware to FastAPI
3. Wrap critical functions with error capture
4. Create log directory
5. Add admin endpoint for error viewing

**Effort:** 2-3 hours
**Risk:** MINIMAL (additive only)
**Benefit:** Visibility into production issues

---

**Note:** This is a MINIMAL baseline. For production-grade monitoring, add Sentry later (requires account setup).
