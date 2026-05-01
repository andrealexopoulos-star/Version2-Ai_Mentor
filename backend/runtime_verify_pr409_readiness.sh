#!/usr/bin/env bash
set -euo pipefail

# Local, non-secret readiness checks for PR #409 runtime verification.
# This script performs static repository checks only by default.
# It never calls live APIs or writes to remote systems.
#
# Usage:
#   bash backend/runtime_verify_pr409_readiness.sh
#   bash backend/runtime_verify_pr409_readiness.sh --expected-sha 07eb4b6e27b5192164c4dd4d6b63a6c54a158072
#   bash backend/runtime_verify_pr409_readiness.sh --run-tests

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

EXPECTED_SHA=""
RUN_TESTS="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --expected-sha)
      EXPECTED_SHA="${2:-}"
      shift 2
      ;;
    --run-tests)
      RUN_TESTS="true"
      shift
      ;;
    *)
      echo "Unknown arg: $1"
      exit 1
      ;;
  esac
done

fail() {
  echo "FAIL: $1"
  exit 1
}

pass() {
  echo "PASS: $1"
}

contains_text() {
  local pattern="$1"
  shift
  python3 - "$pattern" "$@" <<'PY'
import pathlib
import re
import sys

pattern = sys.argv[1]
files = sys.argv[2:]
rx = re.compile(pattern, re.MULTILINE)

for p in files:
    text = pathlib.Path(p).read_text(encoding="utf-8", errors="ignore")
    if rx.search(text):
        sys.exit(0)

sys.exit(1)
PY
}

echo "== PR #409 Runtime Readiness (local/static) =="

CURRENT_SHA="$(git rev-parse HEAD)"
echo "HEAD SHA: $CURRENT_SHA"
if [[ -n "$EXPECTED_SHA" ]]; then
  if [[ "$CURRENT_SHA" != "$EXPECTED_SHA" ]]; then
    fail "HEAD SHA mismatch (expected $EXPECTED_SHA)"
  fi
  pass "HEAD SHA matches expected"
fi

echo
echo "== Required files =="
for f in \
  "backend/routes/billing.py" \
  "backend/routes/stripe_payments.py" \
  "backend/services/topup_service.py" \
  "backend/services/topup_ledger_service.py" \
  "backend/services/payment_state_service.py" \
  "backend/tests/test_topup_route_hydration.py" \
  "supabase/migrations/131_topup_attempts.sql" \
  "supabase/migrations/132_topup_consent_events.sql"
do
  [[ -f "$f" ]] || fail "Missing required file: $f"
done
pass "All required PR #409 files are present"

echo
echo "== Hydration + top-up route guards =="
contains_text "stripe_subscription_id" backend/routes/billing.py \
  || fail "billing route does not hydrate stripe_subscription_id"
contains_text "Billing linkage is incomplete" backend/services/topup_service.py \
  || fail "manual_topup linkage guard missing"
pass "Hydration and linkage guard checks passed"

echo
echo "== Webhook event handlers =="
for evt in "payment_intent.succeeded" "payment_intent.payment_failed" "payment_intent.requires_action"; do
  contains_text "$evt" backend/routes/stripe_payments.py \
    || fail "Missing webhook handler for $evt"
done
pass "Webhook event checks passed"

echo
echo "== Env-var validation audit (static) =="
for key in "STRIPE_API_KEY" "STRIPE_WEBHOOK_SECRET" "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY"; do
  contains_text "$key" backend/core/env_validator.py backend/routes/stripe_payments.py backend/supabase_client.py \
    || fail "Expected env validation reference missing for $key"
done
pass "Required env-var references found in validator/runtime modules"

echo
echo "== Health/version endpoint audit (static) =="
contains_text "@app.get\\(\"/health\"\\)|@api_router.get\\(\"/health\"\\)" backend/server.py \
  || fail "No health endpoint found in backend/server.py"
if contains_text "RELEASE_SHA|GIT_SHA|COMMIT_SHA" backend/server.py backend/routes/health.py; then
  pass "Release/commit env reference found (release metadata exists)"
else
  echo "WARN: no explicit commit SHA reference found in health routes"
fi

echo
echo "== Scope guard (no frontend/website/pricing files in this check) =="
pass "Script performs backend + migration static checks only"

if [[ "$RUN_TESTS" == "true" ]]; then
  echo
  echo "== Running local backend tests =="
  python3 -m pytest backend/tests/test_topup_route_hydration.py -q
  python3 -m pytest backend/tests/test_topup_initiation.py -q
  python3 -m pytest backend/tests/test_billing_usage.py -q
  python3 -m pytest backend/tests/test_topup_webhook_success.py -q
  python3 -m pytest backend/tests/test_topup_webhook_failure.py -q
  python3 -m pytest backend/tests/test_topup_webhook_idempotency.py -q
  python3 -m pytest backend/tests/test_payment_required_state.py -q
  pass "Requested backend test set passed"
else
  echo
  echo "SKIP: test suite not run (use --run-tests)"
fi

echo
pass "PR #409 runtime verification readiness checks completed"
