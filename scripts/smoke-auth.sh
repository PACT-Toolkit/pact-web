#!/usr/bin/env bash
# smoke-auth.sh — end-to-end smoke test for pact-web ↔ pact-auth.
#
# Exercises the /api/auth/* routes against a live pact-web (default :3000)
# backed by a running pact-auth on PACT_AUTH_GRPC_ADDR (default
# postgres://pact:pact@localhost:5432/pact_auth on :9090). Curl-only, no
# Node/Playwright deps, suitable for CI smoke or pre-merge sanity.
#
# Usage:
#   ./scripts/smoke-auth.sh                # against http://localhost:3000
#   BASE_URL=http://localhost:3001 ./scripts/smoke-auth.sh
#
# Each step prints PASS / FAIL with the observed status. Exits 1 on any FAIL.
# Re-runnable: register uses a timestamped email; the verified login user is
# seeded idempotently via direct SQL.

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
PG_URL="${PG_URL:-postgres://pact:pact@localhost:5432/pact_auth?sslmode=disable}"

STAMP="$(date +%s)"
NEW_EMAIL="smoke-new-${STAMP}@example.com"
VERIFIED_EMAIL="smoke-verified@example.com"
PASSWORD='Smoke!Test1234567'
WRONG_PASSWORD='Wrong!Test1234567'

PASS=0
FAIL=0

c_red=$'\033[31m'; c_grn=$'\033[32m'; c_dim=$'\033[2m'; c_rst=$'\033[0m'

step() { printf '\n%s── %s%s\n' "$c_dim" "$1" "$c_rst" >&2; }

ok()   { printf '  %s✔%s %s\n' "$c_grn" "$c_rst" "$1" >&2; PASS=$((PASS+1)); }
bad()  { printf '  %s✘%s %s\n' "$c_red" "$c_rst" "$1" >&2; FAIL=$((FAIL+1)); }

# Each request is split into two helpers so the PASS/FAIL line goes to stderr
# (always visible, even when the caller pipes stdout) and the body returns on
# stdout for callers that want to inspect it.

# do_request <method> <path> <expected> [body]
# Stores response body in $LAST_BODY, status in $LAST_STATUS. Logs to stderr.
LAST_BODY=''
LAST_STATUS=''
do_request() {
  local method="$1" path="$2" expected="$3" body="${4:-}"
  local out status
  out="$(mktemp)"
  if [[ -n "$body" ]]; then
    status="$(curl -sS -o "$out" -w '%{http_code}' \
      -H 'Content-Type: application/json' \
      -X "$method" --data "$body" "$BASE_URL$path")"
  else
    status="$(curl -sS -o "$out" -w '%{http_code}' \
      -X "$method" "$BASE_URL$path")"
  fi
  LAST_BODY="$(cat "$out")"
  LAST_STATUS="$status"
  if [[ "$status" == "$expected" ]]; then
    ok "$method $path → $status" >&2
  else
    bad "$method $path → $status (expected $expected)" >&2
    printf '    body: %s\n' "$(head -c 240 "$out")" >&2
  fi
  rm -f "$out"
}

# expect_status: convenience wrapper that drops the body. Call do_request
# directly when you need to inspect $LAST_BODY.
expect_status() {
  do_request "$@"
}

# expect_redirect <path-with-query> <regex-matching-Location>
expect_redirect() {
  local path="$1" loc_re="$2"
  local hdrs status loc
  hdrs="$(mktemp)"
  status="$(curl -sS -o /dev/null -D "$hdrs" -w '%{http_code}' "$BASE_URL$path")"
  loc="$(awk 'tolower($1) == "location:" { sub(/\r$/, ""); print $2 }' "$hdrs" | tr -d '[:space:]')"
  if [[ "$status" =~ ^30[27]$ ]] && [[ "$loc" =~ $loc_re ]]; then
    ok "GET $path → $status → ${loc:0:80}…"
  else
    bad "GET $path → $status, Location='$loc' (expected ${loc_re})"
  fi
  rm -f "$hdrs"
}

# do_request_authed <method> <path> <expected> <cookie> [body]
# Same as do_request, but with a Cookie header. Used for the settings RPCs
# that read the session token from pact_session.
do_request_authed() {
  local method="$1" path="$2" expected="$3" cookie="$4" body="${5:-}"
  local out status
  out="$(mktemp)"
  if [[ -n "$body" ]]; then
    status="$(curl -sS -o "$out" -w '%{http_code}' \
      -H 'Content-Type: application/json' \
      -H "Cookie: pact_session=$cookie" \
      -X "$method" --data "$body" "$BASE_URL$path")"
  else
    status="$(curl -sS -o "$out" -w '%{http_code}' \
      -H "Cookie: pact_session=$cookie" \
      -X "$method" "$BASE_URL$path")"
  fi
  LAST_BODY="$(cat "$out")"
  LAST_STATUS="$status"
  if [[ "$status" == "$expected" ]]; then
    ok "$method $path → $status (auth)" >&2
  else
    bad "$method $path → $status (expected $expected, auth)" >&2
    printf '    body: %s\n' "$(head -c 240 "$out")" >&2
  fi
  rm -f "$out"
}

expect_status_authed() {
  do_request_authed "$@"
}

find_pg_container() {
  docker ps --format '{{.Names}}' 2>/dev/null \
    | awk '/postgres/ { print; exit }'
}

run_psql() {
  if command -v psql >/dev/null 2>&1; then
    psql "$PG_URL" -v ON_ERROR_STOP=1 "$@"
    return
  fi
  local container
  container="$(find_pg_container)"
  if [[ -z "$container" ]]; then
    echo "no psql binary and no running postgres container" >&2
    return 1
  fi
  docker exec -i "$container" psql -U pact -d pact_auth -v ON_ERROR_STOP=1 "$@"
}

# ─── Pre-flight ─────────────────────────────────────────────────────────────

step "Pre-flight"

if ! curl -sS -o /dev/null -w '%{http_code}\n' "$BASE_URL/login" | grep -q '^200$'; then
  bad "pact-web not reachable at $BASE_URL"
  exit 1
fi
ok "pact-web reachable at $BASE_URL"

if ! run_psql -c 'SELECT 1' >/dev/null 2>&1; then
  bad "Postgres not reachable (PG_URL=$PG_URL or compose container missing)"
  exit 1
fi
ok "Postgres reachable"

# pact-notify, when running, will turn every Register / forgot-password call
# this script makes into a real Brevo send (Free tier = 300/day). Bail out
# unless the operator explicitly opts in via SMOKE_ALLOW_NOTIFY=1.
if curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:9093/healthz 2>/dev/null | grep -q '^200$'; then
  if [[ "${SMOKE_ALLOW_NOTIFY:-0}" != "1" ]]; then
    bad "pact-notify is up on :9093 — running this smoke would burn Brevo quota on test addresses."
    printf '    Stop pact-notify first, or re-run with SMOKE_ALLOW_NOTIFY=1 if you really want emails to fly.\n' >&2
    exit 1
  fi
  ok "pact-notify is up — SMOKE_ALLOW_NOTIFY=1 set, proceeding (Brevo will see real sends)"
else
  ok "pact-notify is not running — safe to fire test events"
fi

# ─── Register: validation ───────────────────────────────────────────────────

step "Register — validation"

expect_status POST /api/auth/register 400 '{}'
expect_status POST /api/auth/register 400 '{"email":"not-an-email","password":"x"}'
# Missing display_name → 400 (the route enforces it before forwarding to gRPC).
expect_status POST /api/auth/register 400 \
  '{"email":"x@example.com","password":"Smoke!Test1234567"}'

# ─── Register: happy path ───────────────────────────────────────────────────

step "Register: fresh user (200 with ok=true)"

do_request POST /api/auth/register 200 \
  "{\"email\":\"$NEW_EMAIL\",\"password\":\"$PASSWORD\",\"display_name\":\"Smoke Tester\"}"
echo "$LAST_BODY" | grep -q '"ok":true' \
  && ok "register response is { ok: true }" \
  || bad "register response missing ok=true: $LAST_BODY"

step "Register: repeat for same email returns 409 with email_already_registered"
do_request POST /api/auth/register 409 \
  "{\"email\":\"$NEW_EMAIL\",\"password\":\"$PASSWORD\",\"display_name\":\"Smoke Tester\"}"
echo "$LAST_BODY" | grep -q '"code":"email_already_registered"' \
  && ok "register collision response carries code=email_already_registered" \
  || bad "register collision response missing stable code: $LAST_BODY"

# ─── Login: unverified → 403 ───────────────────────────────────────────────

step "Login — unverified email → 403"

expect_status POST /api/auth/login 403 \
  "{\"email\":\"$NEW_EMAIL\",\"password\":\"$PASSWORD\"}"

# ─── Seed a verified user, then login ──────────────────────────────────────

step "Seed verified user via SQL (idempotent), then login"

# Ensure the verified-user row exists with credentials. We piggyback on
# Register to create the row + argon2 hash, then mark verified directly.
# Repeat-safe: a fresh seed returns 200, a follow-up run returns 409
# (email_already_registered) which means the row is already there. Both
# satisfy the "row exists with a valid argon2 hash" precondition that the
# UPDATE below relies on. Anything else (4xx other than 409, 5xx) is a
# real failure and we bail.
seed_status="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -X POST --data "{\"email\":\"$VERIFIED_EMAIL\",\"password\":\"$PASSWORD\",\"display_name\":\"Smoke Verified\"}" \
  "$BASE_URL/api/auth/register")"
case "$seed_status" in
  200) ok "seeded $VERIFIED_EMAIL (fresh)" ;;
  409) ok "seeded $VERIFIED_EMAIL (already existed)" ;;
  *)   bad "register seed unexpected status $seed_status"; exit 1 ;;
esac

run_psql -c "UPDATE users SET email_verified_at = now() WHERE email = '$VERIFIED_EMAIL';" >/dev/null \
  && ok "marked $VERIFIED_EMAIL verified" \
  || { bad "could not mark user verified"; exit 1; }

# Reset failed_attempts in case prior runs locked it out.
run_psql -c "UPDATE password_credentials SET failed_attempts = 0, locked_until = NULL
             WHERE user_id = (SELECT id FROM users WHERE email = '$VERIFIED_EMAIL');" >/dev/null

step "Login — wrong password → 401"
expect_status POST /api/auth/login 401 \
  "{\"email\":\"$VERIFIED_EMAIL\",\"password\":\"$WRONG_PASSWORD\"}"

step "Login — correct password → 200 + Set-Cookie pact_session"
hdrs="$(mktemp)"
body_file="$(mktemp)"
status="$(curl -sS -o "$body_file" -D "$hdrs" -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -X POST --data "{\"email\":\"$VERIFIED_EMAIL\",\"password\":\"$PASSWORD\"}" \
  "$BASE_URL/api/auth/login")"

if [[ "$status" == "200" ]]; then
  ok "login → 200"
else
  bad "login → $status; body=$(cat "$body_file")"
fi

session_cookie="$(awk 'tolower($1) == "set-cookie:" && $0 ~ /pact_session=/ { print }' "$hdrs" \
  | sed -n 's/.*pact_session=\([^;]*\).*/\1/p' | head -1)"

if [[ -n "$session_cookie" && "$session_cookie" != '""' ]]; then
  ok "Set-Cookie pact_session present (len=${#session_cookie})"
else
  bad "no pact_session cookie set"
fi

# Confirm the cookie is HttpOnly (auth-route invariant).
if grep -i 'set-cookie:.*pact_session=' "$hdrs" | grep -qi 'httponly'; then
  ok "pact_session cookie is HttpOnly"
else
  bad "pact_session cookie is NOT HttpOnly"
fi

rm -f "$hdrs" "$body_file"

# ─── Authenticated settings RPCs ────────────────────────────────────────────
# These must be exercised BEFORE logout (the cookie is still live) and verify
# both auth-required gating and the sad-path error mapping. Happy-path passkey
# delete/rename require a previously-registered passkey (impossible from curl
# without a virtual authenticator), so we assert the 404/409 paths instead.

step "Settings — unauthenticated requests are rejected with 401"

expect_status POST /api/auth/passkey/register/begin 401 '{"label":"x"}'
expect_status POST /api/auth/passkey/rename 401 \
  '{"passkeyId":"00000000-0000-0000-0000-000000000000","label":"x"}'
expect_status POST /api/auth/passkey/delete 401 \
  '{"passkeyId":"00000000-0000-0000-0000-000000000000"}'
expect_status POST /api/auth/oauth/unlink 401 '{"provider":"github"}'
expect_status POST /api/auth/mfa/revoke 401 \
  '{"factorId":"00000000-0000-0000-0000-000000000000"}'
expect_status POST /api/auth/mfa/recovery-codes 401

step "Passkey register begin — authenticated returns options envelope"

# This creates a passkey_ceremonies row that we never finish. They expire
# server-side after challengeTTL, so it's a benign leak.
do_request_authed POST /api/auth/passkey/register/begin 200 \
  "$session_cookie" '{"label":"smoke-test"}'
echo "$LAST_BODY" | python3 -c '
import json, sys
b = json.loads(sys.stdin.read())
assert "ceremonyId" in b, "missing ceremonyId"
assert "options" in b, "missing options"
assert "publicKey" not in b["options"], "options is still wrapped — route forgot to unwrap publicKey"
for f in ("challenge", "user", "pubKeyCredParams"):
    assert f in b["options"], f"options.{f} missing"
assert "id" in b["options"]["user"], "options.user.id missing"
' \
  && ok "register-begin envelope is unwrapped (top-level challenge/user/pubKeyCredParams)" \
  || bad "register-begin envelope is malformed: $LAST_BODY"

step "Passkey rename — body validation (auth, missing fields)"

expect_status_authed POST /api/auth/passkey/rename 400 "$session_cookie" '{}'
expect_status_authed POST /api/auth/passkey/rename 400 "$session_cookie" \
  '{"passkeyId":"x"}'
expect_status_authed POST /api/auth/passkey/rename 404 "$session_cookie" \
  '{"passkeyId":"00000000-0000-0000-0000-000000000000","label":"new"}'

step "Passkey delete — 404 for unknown passkey id (auth)"

expect_status_authed POST /api/auth/passkey/delete 400 "$session_cookie" '{}'
expect_status_authed POST /api/auth/passkey/delete 404 "$session_cookie" \
  '{"passkeyId":"00000000-0000-0000-0000-000000000000"}'

step "OAuth unlink — 400 invalid provider, 404 not connected"

expect_status_authed POST /api/auth/oauth/unlink 400 "$session_cookie" \
  '{"provider":"bogus"}'
expect_status_authed POST /api/auth/oauth/unlink 404 "$session_cookie" \
  '{"provider":"github"}'

step "MFA revoke — 404 for unknown factor id (auth)"

expect_status_authed POST /api/auth/mfa/revoke 400 "$session_cookie" '{}'
expect_status_authed POST /api/auth/mfa/revoke 404 "$session_cookie" \
  '{"factorId":"00000000-0000-0000-0000-000000000000"}'

step "MFA recovery-codes — 409 when no TOTP factor enrolled (auth)"

expect_status_authed POST /api/auth/mfa/recovery-codes 409 "$session_cookie"

# ─── Token-based routes (verify-email, reset-password) ─────────────────────

step "verify-email — missing token redirects to failure page"

expect_redirect '/api/auth/verify-email' \
  'verify-email/failed.*reason=missing_token'

step "verify-email — bogus token redirects with invalid_or_expired"

expect_redirect '/api/auth/verify-email?token=not-a-real-token' \
  'verify-email/failed.*reason=invalid_or_expired'

step "reset-password — body validation"

expect_status POST /api/auth/reset-password 400 '{}'
expect_status POST /api/auth/reset-password 400 '{"token":"x"}'

step "reset-password — bogus token → 401"

expect_status POST /api/auth/reset-password 401 \
  "{\"token\":\"bogus-token\",\"password\":\"$PASSWORD\"}"

# ─── Logout ────────────────────────────────────────────────────────────────

step "Logout — clears the session cookie"
hdrs="$(mktemp)"
status="$(curl -sS -o /dev/null -D "$hdrs" -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -H "Cookie: pact_session=$session_cookie" \
  -X POST "$BASE_URL/api/auth/logout")"
[[ "$status" == "200" ]] && ok "logout → 200" || bad "logout → $status"

if grep -i 'set-cookie:.*pact_session=' "$hdrs" | grep -qiE 'max-age=0|expires='; then
  ok "logout cleared pact_session cookie"
else
  bad "logout did not clear pact_session cookie"
fi
rm -f "$hdrs"

# ─── Passkey login: begin (anti-enum, no creds needed) ─────────────────────

step "Passkey — beginPasskeyLogin returns options envelope"

do_request POST /api/auth/passkey/login/begin 200 \
  "{\"email\":\"$VERIFIED_EMAIL\"}"
# The browser-side decoder reads challenge/allowCredentials directly off
# `options`. If the route forgets to unwrap go-webauthn's `{publicKey:{...}}`
# wrapper, options.challenge is undefined and base64UrlToBuffer trips on it
# with "Cannot read properties of undefined (reading 'length')".
echo "$LAST_BODY" | python3 -c '
import json, sys
b = json.loads(sys.stdin.read())
assert "ceremonyId" in b, "missing ceremonyId"
assert "options" in b, "missing options"
assert "publicKey" not in b["options"], "options is still wrapped — route forgot to unwrap publicKey"
assert "challenge" in b["options"], "options.challenge missing"
' \
  && ok "passkey-login envelope is unwrapped (top-level challenge)" \
  || bad "passkey-login envelope is malformed: $LAST_BODY"

# Empty email also accepted (discoverable login flow).
expect_status POST /api/auth/passkey/login/begin 200 '{}'

# ─── OAuth start: each provider redirects to its authorize URL ─────────────

step "OAuth — /api/auth/oauth/start redirects per provider"

expect_redirect '/api/auth/oauth/start?provider=github' \
  '^https://github\.com/login/oauth/authorize\?'
expect_redirect '/api/auth/oauth/start?provider=google' \
  '^https://accounts\.google\.com/o/oauth2/'
expect_redirect '/api/auth/oauth/start?provider=meta' \
  '^https://(www\.facebook\.com|facebook\.com)/'

step "OAuth — unknown provider → 400"
expect_status GET '/api/auth/oauth/start?provider=bogus' 400

# ─── Forgot password (anti-enum) ────────────────────────────────────────────

step "Forgot password — anti-enum 200 for any address"
expect_status POST /api/auth/forgot-password 200 \
  "{\"email\":\"nobody-${STAMP}@example.com\"}"
expect_status POST /api/auth/forgot-password 400 '{}'

# ─── Summary ────────────────────────────────────────────────────────────────

printf '\n────────────────────────────────────────────\n'
printf 'Smoke results: %s%d passed%s, %s%d failed%s\n' \
  "$c_grn" "$PASS" "$c_rst" "$c_red" "$FAIL" "$c_rst"
printf '────────────────────────────────────────────\n'

[[ "$FAIL" -eq 0 ]] || exit 1
