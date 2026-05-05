#!/usr/bin/env bash
# 2026-05-05 (13041978) — CI gate: forbid LLM calls that bypass the metering chokepoint.
#
# Per OPS Manual entry 01 principle P1: every LLM token spent at any provider MUST
# be recorded in usage_ledger within the same request lifecycle.
#
# Two checks:
#   A. Python — no direct openai/anthropic/google/perplexity SDK imports outside llm_router.py
#   B. Deno  — every file with a fetch() to a provider API must also contain recordUsage / recordUsageSonar
#
# Exit codes:
#   0 = no orphan calls found
#   1 = at least one orphan call found (PR fails CI)
#
# Usage (CI):  scripts/check-no-orphan-llm-calls.sh
# Usage (local):  scripts/check-no-orphan-llm-calls.sh --verbose

set -euo pipefail

VERBOSE="${1:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

EXIT_CODE=0
ORPHAN_COUNT=0

log() { echo "[no-orphan-llm-calls] $*"; }
verbose() { [ "$VERBOSE" = "--verbose" ] && echo "[no-orphan-llm-calls]   $*" || true; }

# ─────────────────────────────────────────────────────────────────────────
# A. Python — direct provider SDK imports outside the chokepoint
# ─────────────────────────────────────────────────────────────────────────
log "Check A: Python — direct provider SDK imports must only appear in llm_router.py"

# Allowed files (the chokepoint itself + its provider-adapter modules).
ALLOWED_PY_FILES=(
    "backend/core/llm_router.py"
    "backend/core/providers/"
    "backend/core/llm/"
    "backend/jobs/provider_quota_check.py"   # admin-endpoint poller — not LLM calls
    "backend/jobs/daily_reconciliation.py"   # billing reconciliation — admin endpoints
)

# Patterns that indicate a direct provider SDK import / call.
PY_FORBIDDEN_PATTERNS=(
    'from openai import'
    'import openai'
    'openai\.AsyncOpenAI'
    'openai\.OpenAI('
    'from anthropic import'
    'import anthropic'
    'anthropic\.Anthropic('
    'from google\.generativeai'
    'import google\.generativeai'
)

for pattern in "${PY_FORBIDDEN_PATTERNS[@]}"; do
    # Find all .py files matching the pattern, then exclude allowed.
    while IFS= read -r match; do
        [ -z "$match" ] && continue
        file="${match%%:*}"
        # Skip allowed files
        skip=false
        for allowed in "${ALLOWED_PY_FILES[@]}"; do
            if [[ "$file" == "$allowed" || "$file" == "$allowed"* ]]; then
                skip=true
                break
            fi
        done
        $skip && continue
        # Skip tests + venv + node_modules
        if [[ "$file" == *test* || "$file" == *venv* || "$file" == *node_modules* || "$file" == *__pycache__* ]]; then
            continue
        fi
        # Skip duplicate-name junk files (e.g. " 2.py", " 3.py")
        if [[ "$file" =~ \ [0-9]+\.py$ ]]; then
            continue
        fi
        log "ORPHAN PYTHON: $match"
        ORPHAN_COUNT=$((ORPHAN_COUNT + 1))
        EXIT_CODE=1
    done < <(grep -RIn "$pattern" backend/ --include="*.py" 2>/dev/null || true)
done

verbose "Python check complete."

# ─────────────────────────────────────────────────────────────────────────
# B. Deno edge functions — every fetch to a provider API needs adjacent recordUsage
# ─────────────────────────────────────────────────────────────────────────
log "Check B: Deno edge fns — every provider API fetch must be in a file that also calls recordUsage*"

# Allowed files (helpers/registry/admin polls that don't fire user-billable LLM calls).
ALLOWED_TS_FILES=(
    "supabase/functions/_shared/"
)

# Provider URLs to detect.
PROVIDER_URLS=(
    "api\.openai\.com"
    "api\.anthropic\.com"
    "api\.perplexity\.ai"
    "generativelanguage\.googleapis\.com"
)

# Find every .ts file in supabase/functions that contains a provider URL.
declare -a CANDIDATE_FILES=()
for url_pat in "${PROVIDER_URLS[@]}"; do
    while IFS= read -r file; do
        [ -z "$file" ] && continue
        # Skip allowed files
        skip=false
        for allowed in "${ALLOWED_TS_FILES[@]}"; do
            if [[ "$file" == "$allowed"* ]]; then
                skip=true
                break
            fi
        done
        $skip && continue
        CANDIDATE_FILES+=("$file")
    done < <(grep -RIln -E "$url_pat" supabase/functions/ --include="*.ts" 2>/dev/null || true)
done

# Dedupe candidate files.
UNIQUE_FILES=$(printf "%s\n" "${CANDIDATE_FILES[@]}" | sort -u)

# Each candidate must also contain recordUsage or recordUsageSonar.
while IFS= read -r file; do
    [ -z "$file" ] && continue
    if ! grep -qE "recordUsage(Sonar)?\(" "$file"; then
        log "ORPHAN EDGE FN: $file — calls a provider API but never calls recordUsage/recordUsageSonar"
        ORPHAN_COUNT=$((ORPHAN_COUNT + 1))
        EXIT_CODE=1
    else
        verbose "OK: $file calls recordUsage*"
    fi
done <<< "$UNIQUE_FILES"

# ─────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────
echo ""
if [ $EXIT_CODE -eq 0 ]; then
    log "PASS — no orphan LLM calls detected. All provider invocations are routed through the metering chokepoint."
else
    log "FAIL — $ORPHAN_COUNT orphan LLM call site(s) detected. See lines above."
    log ""
    log "How to fix:"
    log "  Python:  Replace direct openai/anthropic/google imports with llm_router.llm_chat_with_usage(user_id, tier, ...)"
    log "  Deno:    Add 'await recordUsage({...})' immediately after the provider response is parsed."
    log ""
    log "Allowed exceptions are listed in scripts/check-no-orphan-llm-calls.sh — extend with care."
fi

exit $EXIT_CODE
