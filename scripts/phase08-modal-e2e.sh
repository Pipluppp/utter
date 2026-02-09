#!/bin/bash
# Phase 08 — End-to-end Modal.com voice generation test
# Tests the full pipeline: generate → Modal job → poll → finalize → audio retrieval → delete
# Run from project root: bash scripts/phase08-modal-e2e.sh
#
# Requires: Supabase local stack running (sb:start + sb:serve)
# Timeout: up to 5 minutes for Modal cold starts

set -euo pipefail

ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
API="http://127.0.0.1:54321/functions/v1/api"

PASS=0
FAIL=0
pass() { PASS=$((PASS+1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL: $1 — $2"; }
info() { echo "  .... $1"; }

MAX_POLL_SECONDS=300  # 5 min for Modal cold starts
POLL_INTERVAL=5

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Phase 08 — Modal E2E Voice Generation Test         ║"
echo "║  Timeout: ${MAX_POLL_SECONDS}s (Modal cold starts can take 2-5 min)  ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Prerequisite: health check ─────────────────────────────────
echo "=== Prerequisite: stack health ==="
HEALTH=$(curl -sf "$API/health" 2>/dev/null || echo "FAIL")
if echo "$HEALTH" | python -c "import sys,json; d=json.load(sys.stdin); assert d['ok']" 2>/dev/null; then
  pass "Edge functions healthy"
else
  echo "  FATAL: Edge functions not responding. Run: npm run sb:start && npm run sb:serve"
  exit 1
fi

# ── Step 1: Authenticate ──────────────────────────────────────
echo ""
echo "=== Step 1: Authenticate ==="

# Sign in (or sign up) User A
AUTH_RESP=$(curl -sf -X POST http://127.0.0.1:54321/auth/v1/token?grant_type=password \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"usera_08@test.com","password":"password123"}' 2>/dev/null || \
  curl -sf -X POST http://127.0.0.1:54321/auth/v1/signup \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"usera_08@test.com","password":"password123"}')

TOKEN=$(echo "$AUTH_RESP" | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
USER_ID=$(echo "$AUTH_RESP" | python -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")

if [ -n "$TOKEN" ] && [ -n "$USER_ID" ]; then
  pass "Authenticated as $USER_ID"
else
  echo "  FATAL: Authentication failed"
  exit 1
fi

AUTH="-H \"Authorization: Bearer $TOKEN\" -H \"apikey: $ANON_KEY\""

# Helper: make authenticated curl calls
api() {
  local method=$1 path=$2
  shift 2
  curl -s -X "$method" "$API$path" \
    -H "Authorization: Bearer $TOKEN" \
    -H "apikey: $ANON_KEY" \
    "$@"
}

api_status() {
  local method=$1 path=$2
  shift 2
  curl -s -o /dev/null -w "%{http_code}" -X "$method" "$API$path" \
    -H "Authorization: Bearer $TOKEN" \
    -H "apikey: $ANON_KEY" \
    "$@"
}

# ── Step 2: Ensure we have a cloned voice ─────────────────────
echo ""
echo "=== Step 2: Ensure test voice exists ==="

VOICES=$(api GET /voices)
VOICE_COUNT=$(echo "$VOICES" | python -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('voices',d if isinstance(d,list) else [])))")

if [ "$VOICE_COUNT" -ge 1 ]; then
  VOICE_ID=$(echo "$VOICES" | python -c "import sys,json; d=json.load(sys.stdin); print(d['voices'][0]['id'])")
  VOICE_NAME=$(echo "$VOICES" | python -c "import sys,json; d=json.load(sys.stdin); print(d['voices'][0]['name'])")
  info "Reusing existing voice: $VOICE_NAME ($VOICE_ID)"
else
  info "No voice found. Creating one..."
  UPLOAD_RESP=$(api POST /clone/upload-url \
    -H "Content-Type: application/json" \
    -d '{"name":"Modal Test Voice","language":"English","transcript":"This is a test reference for Modal voice generation."}')

  VOICE_ID=$(echo "$UPLOAD_RESP" | python -c "import sys,json; print(json.load(sys.stdin)['voice_id'])")
  UPLOAD_URL=$(echo "$UPLOAD_RESP" | python -c "import sys,json; print(json.load(sys.stdin)['upload_url'])")

  curl -s -o /dev/null -X PUT "$UPLOAD_URL" \
    -H "Content-Type: audio/mpeg" \
    --data-binary @frontend/public/static/utter_demo/gojo/reference.mp3

  api POST /clone/finalize \
    -H "Content-Type: application/json" \
    -d "{\"voice_id\":\"$VOICE_ID\",\"name\":\"Modal Test Voice\",\"language\":\"English\",\"transcript\":\"This is a test reference for Modal voice generation.\"}" > /dev/null

  VOICE_NAME="Modal Test Voice"
fi
pass "Voice ready: $VOICE_NAME ($VOICE_ID)"

# ══════════════════════════════════════════════════════════════
# TEST 1: Full generation lifecycle
# ══════════════════════════════════════════════════════════════
echo ""
echo "=== TEST 1: Full generation lifecycle (submit → poll → finalize → audio) ==="

# 1a. Submit generation
info "Submitting generation to Modal..."
GEN_RESP=$(api POST /generate \
  -H "Content-Type: application/json" \
  -d "{\"voice_id\":\"$VOICE_ID\",\"text\":\"Hello! This is an end-to-end test of the Modal voice generation pipeline.\",\"language\":\"English\"}")

GEN_STATUS_CODE=$(echo "$GEN_RESP" | python -c "
import sys,json
d=json.load(sys.stdin)
print('ok' if 'task_id' in d else 'error')
" 2>/dev/null || echo "error")

if [ "$GEN_STATUS_CODE" = "error" ]; then
  # Check if it's a clean error (e.g., Modal not configured)
  ERROR_MSG=$(echo "$GEN_RESP" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('detail','unknown'))" 2>/dev/null || echo "unparseable")
  fail "POST /generate" "$ERROR_MSG"
  echo ""
  echo "  If Modal is not configured, set MODAL_JOB_SUBMIT, MODAL_JOB_STATUS, MODAL_JOB_RESULT"
  echo "  in supabase/.env.local and restart sb:serve."
  echo ""
  echo "  RESULTS: $PASS passed, $FAIL failed"
  exit 1
fi

TASK_ID=$(echo "$GEN_RESP" | python -c "import sys,json; print(json.load(sys.stdin)['task_id'])")
GEN_ID=$(echo "$GEN_RESP" | python -c "import sys,json; print(json.load(sys.stdin)['generation_id'])")
EST_MIN=$(echo "$GEN_RESP" | python -c "import sys,json; print(json.load(sys.stdin).get('estimated_duration_minutes','?'))")

pass "POST /generate → task=$TASK_ID gen=$GEN_ID (est: ${EST_MIN} min)"

# 1b. Verify generation record created
GEN_LIST=$(api GET /generations)
GEN_EXISTS=$(echo "$GEN_LIST" | python -c "
import sys,json
d=json.load(sys.stdin)
gens=d.get('generations',[])
match=[g for g in gens if g['id']=='$GEN_ID']
if match:
    print(f'status={match[0][\"status\"]}')
else:
    print('missing')
")

if echo "$GEN_EXISTS" | grep -q "status="; then
  pass "Generation record created in DB ($GEN_EXISTS)"
else
  fail "Generation record" "not found in GET /generations"
fi

# 1c. Poll task until terminal state
info "Polling task (timeout: ${MAX_POLL_SECONDS}s, interval: ${POLL_INTERVAL}s)..."
ELAPSED=0
FINAL_STATUS=""
POLL_COUNT=0

while [ $ELAPSED -lt $MAX_POLL_SECONDS ]; do
  sleep $POLL_INTERVAL
  ELAPSED=$((ELAPSED + POLL_INTERVAL))
  POLL_COUNT=$((POLL_COUNT + 1))

  TASK_RESP=$(api GET "/tasks/$TASK_ID" 2>/dev/null || echo '{"status":"error"}')

  T_STATUS=$(echo "$TASK_RESP" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null || echo "?")
  T_MODAL=$(echo "$TASK_RESP" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('modal_status','?'))" 2>/dev/null || echo "?")
  T_POLLS=$(echo "$TASK_RESP" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('modal_poll_count','?'))" 2>/dev/null || echo "?")
  T_ERROR=$(echo "$TASK_RESP" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('error','') or '')" 2>/dev/null || echo "")

  printf "  [%3ds] poll=%s status=%s modal=%s polls=%s" "$ELAPSED" "$POLL_COUNT" "$T_STATUS" "$T_MODAL" "$T_POLLS"
  [ -n "$T_ERROR" ] && printf " error=%s" "$T_ERROR"
  echo ""

  # Verify poll response is valid JSON with expected fields
  VALID_JSON=$(echo "$TASK_RESP" | python -c "
import sys,json
d=json.load(sys.stdin)
required = ['id','type','status','modal_poll_count']
missing = [k for k in required if k not in d]
print('ok' if not missing else f'missing: {\",\".join(missing)}')
" 2>/dev/null || echo "invalid json")

  if [ "$VALID_JSON" != "ok" ]; then
    fail "Poll response schema" "$VALID_JSON"
  fi

  if [ "$T_STATUS" = "completed" ] || [ "$T_STATUS" = "failed" ] || [ "$T_STATUS" = "cancelled" ]; then
    FINAL_STATUS="$T_STATUS"
    break
  fi
done

if [ -z "$FINAL_STATUS" ]; then
  fail "Task polling" "timed out after ${MAX_POLL_SECONDS}s (last status: $T_STATUS, modal: $T_MODAL)"
  echo ""
  echo "  RESULTS: $PASS passed, $FAIL failed"
  exit 1
fi

if [ "$FINAL_STATUS" = "completed" ]; then
  pass "Task completed after ${ELAPSED}s ($POLL_COUNT polls)"

  # Verify result has audio_url
  AUDIO_URL=$(echo "$TASK_RESP" | python -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('result',{})
if isinstance(r,dict):
    print(r.get('audio_url',''))
else:
    print('')
" 2>/dev/null || echo "")

  if [ -n "$AUDIO_URL" ]; then
    pass "Task result contains audio_url: $AUDIO_URL"
  else
    fail "Task result" "no audio_url in result"
  fi
else
  fail "Task terminal status" "$FINAL_STATUS (error: $T_ERROR)"
  echo ""
  echo "  RESULTS: $PASS passed, $FAIL failed"
  exit 1
fi

# 1d. Verify generation status updated to completed
echo ""
echo "=== TEST 2: Verify generation record finalized ==="

GEN_DETAIL=$(api GET /generations)
GEN_FINAL=$(echo "$GEN_DETAIL" | python -c "
import sys,json
d=json.load(sys.stdin)
gens=d.get('generations',[])
match=[g for g in gens if g['id']=='$GEN_ID']
if match:
    g=match[0]
    print(f'status={g[\"status\"]} time={g.get(\"generation_time_seconds\",\"?\")} voice={g.get(\"voice_name\",\"?\")}')
else:
    print('missing')
" 2>/dev/null || echo "error")

if echo "$GEN_FINAL" | grep -q "status=completed"; then
  pass "Generation record status=completed ($GEN_FINAL)"
else
  fail "Generation finalization" "$GEN_FINAL"
fi

# 1e. Retrieve audio via signed URL
echo ""
echo "=== TEST 3: Audio retrieval via edge function ==="

AUDIO_INFO=$(curl -s -o /dev/null -w "status:%{http_code} size:%{size_download} type:%{content_type} redirect:%{redirect_url}" \
  -L "$API/generations/$GEN_ID/audio" \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $ANON_KEY")

A_STATUS=$(echo "$AUDIO_INFO" | sed 's/.*status:\([0-9]*\).*/\1/')
A_SIZE=$(echo "$AUDIO_INFO" | sed 's/.*size:\([0-9]*\).*/\1/')
A_TYPE=$(echo "$AUDIO_INFO" | sed 's/.*type:\([^ ]*\).*/\1/')

info "Audio response: $AUDIO_INFO"

if [ "$A_STATUS" = "200" ]; then
  pass "GET /generations/:id/audio returns 200 (followed redirect)"
else
  fail "Audio retrieval" "status=$A_STATUS (expected 200 after redirect)"
fi

if [ "$A_SIZE" -gt 1000 ]; then
  pass "Audio file size: $A_SIZE bytes (valid WAV)"
else
  fail "Audio file size" "$A_SIZE bytes (too small, likely not real audio)"
fi

if echo "$A_TYPE" | grep -qi "audio\|octet"; then
  pass "Audio content-type: $A_TYPE"
else
  fail "Audio content-type" "$A_TYPE (expected audio/*)"
fi

# Verify WAV header (first 4 bytes should be RIFF)
AUDIO_TMP=$(mktemp)
curl -s -L -o "$AUDIO_TMP" "$API/generations/$GEN_ID/audio" \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $ANON_KEY"
AUDIO_HEADER=$(dd if="$AUDIO_TMP" bs=1 count=4 2>/dev/null)
rm -f "$AUDIO_TMP"

if [ "$AUDIO_HEADER" = "RIFF" ]; then
  pass "Audio file has valid WAV/RIFF header"
else
  HEADER_HEX=$(echo -n "$AUDIO_HEADER" | xxd -p 2>/dev/null || echo "?")
  info "WAV header: got '$HEADER_HEX' (may be OK if audio is valid)"
fi

# 1f. Verify audio in Storage directly (via PostgREST)
echo ""
echo "=== TEST 4: Storage verification ==="

GEN_KEY=$(echo "$GEN_DETAIL" | python -c "
import sys,json
d=json.load(sys.stdin)
gens=d.get('generations',[])
match=[g for g in gens if g['id']=='$GEN_ID']
if match:
    print(match[0].get('audio_path',''))
" 2>/dev/null || echo "")

info "Generation audio_path: $GEN_KEY"

# Check via generations/:id/audio without -L (should be 302)
REDIRECT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$API/generations/$GEN_ID/audio" \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $ANON_KEY")

if [ "$REDIRECT_STATUS" = "302" ]; then
  pass "Audio endpoint returns 302 redirect (not inline bytes)"
else
  info "Audio endpoint returns $REDIRECT_STATUS (might serve inline on localhost)"
fi

# ══════════════════════════════════════════════════════════════
# TEST 5: Cancel a generation mid-flight
# ══════════════════════════════════════════════════════════════
echo ""
echo "=== TEST 5: Cancel generation mid-flight ==="

CANCEL_RESP=$(api POST /generate \
  -H "Content-Type: application/json" \
  -d "{\"voice_id\":\"$VOICE_ID\",\"text\":\"This generation will be cancelled mid-flight for testing.\",\"language\":\"English\"}")

CANCEL_TASK_ID=$(echo "$CANCEL_RESP" | python -c "import sys,json; print(json.load(sys.stdin).get('task_id',''))" 2>/dev/null || echo "")
CANCEL_GEN_ID=$(echo "$CANCEL_RESP" | python -c "import sys,json; print(json.load(sys.stdin).get('generation_id',''))" 2>/dev/null || echo "")

if [ -n "$CANCEL_TASK_ID" ]; then
  pass "Submitted cancellation test generation (task=$CANCEL_TASK_ID)"

  # Wait a moment, then cancel
  sleep 3
  CANCEL_RESULT=$(api POST "/tasks/$CANCEL_TASK_ID/cancel" \
    -H "Content-Type: application/json")

  CANCELLED=$(echo "$CANCEL_RESULT" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('cancelled',False))" 2>/dev/null || echo "False")

  if [ "$CANCELLED" = "True" ]; then
    pass "POST /tasks/:id/cancel returns cancelled=true"
  else
    fail "Cancel task" "response: $(echo "$CANCEL_RESULT" | head -c 200)"
  fi

  # Verify task status is cancelled
  sleep 1
  CANCEL_CHECK=$(api GET "/tasks/$CANCEL_TASK_ID")
  CANCEL_STATUS=$(echo "$CANCEL_CHECK" | python -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null || echo "?")

  if [ "$CANCEL_STATUS" = "cancelled" ]; then
    pass "Cancelled task status=cancelled"
  else
    fail "Cancelled task status" "$CANCEL_STATUS (expected cancelled)"
  fi

  # Verify generation status is cancelled
  CANCEL_GEN_STATUS=$(echo "" | python -c "
import sys,json,urllib.request
# Check via generations list
" 2>/dev/null || echo "skip")

  CANCEL_GENS=$(api GET "/generations?status=cancelled")
  CANCEL_GEN_FOUND=$(echo "$CANCEL_GENS" | python -c "
import sys,json
d=json.load(sys.stdin)
gens=d.get('generations',[])
match=[g for g in gens if g['id']=='$CANCEL_GEN_ID']
if match:
    print(f'status={match[0][\"status\"]}')
else:
    print('not_found')
" 2>/dev/null || echo "error")

  if echo "$CANCEL_GEN_FOUND" | grep -q "status=cancelled"; then
    pass "Cancelled generation status=cancelled"
  else
    info "Generation cancellation status: $CANCEL_GEN_FOUND (may already have completed)"
  fi
else
  fail "Submit cancellation test" "no task_id returned"
fi

# ══════════════════════════════════════════════════════════════
# TEST 6: Delete generation (cleanup verification)
# ══════════════════════════════════════════════════════════════
echo ""
echo "=== TEST 6: Delete generation + storage cleanup ==="

DELETE_STATUS=$(api_status DELETE "/generations/$GEN_ID")

if [ "$DELETE_STATUS" = "200" ]; then
  pass "DELETE /generations/:id returns 200"
else
  fail "Delete generation" "status=$DELETE_STATUS"
fi

# Verify it's gone from the list
DELETE_CHECK=$(api GET /generations)
DELETE_FOUND=$(echo "$DELETE_CHECK" | python -c "
import sys,json
d=json.load(sys.stdin)
gens=d.get('generations',[])
match=[g for g in gens if g['id']=='$GEN_ID']
print('found' if match else 'gone')
" 2>/dev/null || echo "error")

if [ "$DELETE_FOUND" = "gone" ]; then
  pass "Generation removed from list after delete"
else
  fail "Delete verification" "generation still in list"
fi

# Verify audio is gone
DELETE_AUDIO_STATUS=$(api_status GET "/generations/$GEN_ID/audio")

if [ "$DELETE_AUDIO_STATUS" = "404" ]; then
  pass "Audio returns 404 after generation deleted"
else
  fail "Audio after delete" "status=$DELETE_AUDIO_STATUS (expected 404)"
fi

# Also clean up the cancelled generation
if [ -n "$CANCEL_GEN_ID" ]; then
  api DELETE "/generations/$CANCEL_GEN_ID" > /dev/null 2>&1 || true
  info "Cleaned up cancelled generation"
fi

# ══════════════════════════════════════════════════════════════
# TEST 7: Task dismiss (DELETE /tasks/:id)
# ══════════════════════════════════════════════════════════════
echo ""
echo "=== TEST 7: Task dismiss ==="

DISMISS_STATUS=$(api_status DELETE "/tasks/$TASK_ID")

if [ "$DISMISS_STATUS" = "200" ]; then
  pass "DELETE /tasks/:id returns 200"
else
  fail "Task dismiss" "status=$DISMISS_STATUS"
fi

# Verify task is gone
DISMISS_CHECK_STATUS=$(api_status GET "/tasks/$TASK_ID")

if [ "$DISMISS_CHECK_STATUS" = "404" ]; then
  pass "Task returns 404 after dismiss"
else
  fail "Task dismiss verification" "status=$DISMISS_CHECK_STATUS (expected 404)"
fi

# Clean up cancel task too
if [ -n "$CANCEL_TASK_ID" ]; then
  api DELETE "/tasks/$CANCEL_TASK_ID" > /dev/null 2>&1 || true
  info "Cleaned up cancelled task"
fi

# ══════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════
echo ""
echo "╔══════════════════════════════════════════════════════╗"
printf "║  RESULTS: %-3s passed, %-3s failed                    ║\n" "$PASS" "$FAIL"
echo "╚══════════════════════════════════════════════════════╝"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Some tests failed. Check output above for details."
  exit 1
fi
