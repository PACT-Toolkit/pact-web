#!/usr/bin/env bash
#
# dev-lan.sh — Next.js dev server bound to all interfaces (0.0.0.0)
# so a phone on the same Wi-Fi can reach the laptop. Plain HTTP by
# default; pass `--https` for an mkcert-issued LAN cert (required for
# WebAuthn / passkeys, optional for everything else).
#
# Three things have to all be right for phone-on-Wi-Fi to work:
#
#   1. The dev server must LISTEN on 0.0.0.0, not localhost. (Next.js
#      defaults to localhost-only — that's the #1 cause of "site can't
#      be reached" on the phone.) We pass `-H 0.0.0.0` below.
#
#   2. The macOS firewall must allow incoming connections to Node.
#      First run typically prompts; if you said "Deny" once and now
#      can't undo it:
#        System Settings → Network → Firewall → Options → remove `node`.
#      If "Block all incoming connections" is on, this won't work at
#      all — turn it off for the duration of dev.
#
#   3. The email-link host must be a LAN URL the phone can actually
#      reach. We force that by exporting PACT_AUTH_DEFAULT_RETURN_TO
#      below, so any register call — even from http://localhost — pins
#      the link to the LAN host. defaultReturnTo() prefers the env var
#      over the inbound Host header.
#
# HTTPS variant adds a 4th requirement: the phone must trust the
# mkcert CA covering the LAN IP. Get the CA via `mkcert -CAROOT`,
# AirDrop the rootCA.pem to the phone, install the profile, then
# enable trust in:
#   iOS:     Settings → General → About → Certificate Trust Settings
#   Android: Settings → Security → Install from storage
#
# Usage:
#   pnpm dev:lan          # plain HTTP — email verify / password reset
#   pnpm dev:https:lan    # mkcert + HTTPS — also unlocks passkeys
#
# Overrides:
#   LAN_IP=192.168.x.x    pnpm dev:lan      # force a specific IP
#   LAN_PORT=3001         pnpm dev:lan      # different port
#   ENV_FILE=./env/local.env pnpm dev:lan   # MSW mock-mode (rare)

set -euo pipefail

USE_HTTPS=0
case "${1:-}" in
  --https) USE_HTTPS=1 ;;
  '' ) ;;
  *) echo "unknown argument: $1 (expected --https or nothing)" >&2; exit 2 ;;
esac

PORT="${LAN_PORT:-3000}"
# Default to env/local-real.env: LAN dev with a phone only makes sense
# against real pact-auth + pact-notify — mock-mode would never emit a
# verify-email Kafka event in the first place. Override via ENV_FILE.
ENV_FILE="${ENV_FILE:-./env/local-real.env}"

# ---- LAN IP detection -------------------------------------------------------

detect_lan_ip() {
  if [[ -n "${LAN_IP:-}" ]]; then
    echo "${LAN_IP}"
    return
  fi
  if ip="$(ipconfig getifaddr en0 2>/dev/null)" && [[ -n "${ip}" ]]; then
    echo "${ip}"
    return
  fi
  if ip="$(ipconfig getifaddr en1 2>/dev/null)" && [[ -n "${ip}" ]]; then
    echo "${ip}"
    return
  fi
  if command -v hostname >/dev/null 2>&1; then
    if ip="$(hostname -I 2>/dev/null | awk '{print $1}')" && [[ -n "${ip}" ]]; then
      echo "${ip}"
      return
    fi
  fi
  echo ""
}

LAN_IP="$(detect_lan_ip)"
if [[ -z "${LAN_IP}" ]]; then
  echo "Could not auto-detect LAN IP. Re-run with LAN_IP=192.168.x.x pnpm run dev:lan" >&2
  exit 1
fi

# ---- HTTPS bits (cert minting), only when --https -------------------------

CERT_DIR="certificates"
CERT_FILE="${CERT_DIR}/localhost.pem"
KEY_FILE="${CERT_DIR}/localhost-key.pem"
HOSTS_FILE="${CERT_DIR}/.hosts"

if [[ "${USE_HTTPS}" -eq 1 ]]; then
  if ! command -v mkcert >/dev/null 2>&1; then
    cat >&2 <<EOM
mkcert is not installed.

  brew install mkcert    # macOS
  # see https://github.com/FiloSottile/mkcert for other platforms

Then run once per machine:

  mkcert -install

After that, this script will mint a cert covering localhost + your
LAN IP and start the dev server over HTTPS.
EOM
    exit 1
  fi

  HOSTS="localhost 127.0.0.1 ::1 ${LAN_IP}"
  WANT_HASH="$(printf '%s' "${HOSTS}" | shasum -a 256 | awk '{print $1}')"

  mkdir -p "${CERT_DIR}"
  NEED_REGEN=1
  if [[ -f "${CERT_FILE}" && -f "${KEY_FILE}" && -f "${HOSTS_FILE}" ]]; then
    if [[ "$(cat "${HOSTS_FILE}")" == "${WANT_HASH}" ]]; then
      NEED_REGEN=0
    fi
  fi

  if [[ "${NEED_REGEN}" -eq 1 ]]; then
    echo ">> minting cert for: ${HOSTS}"
    # shellcheck disable=SC2086
    mkcert -cert-file "${CERT_FILE}" -key-file "${KEY_FILE}" ${HOSTS}
    printf '%s' "${WANT_HASH}" > "${HOSTS_FILE}"
  fi
fi

# ---- returnTo pinning + banner --------------------------------------------

SCHEME="http"
if [[ "${USE_HTTPS}" -eq 1 ]]; then
  SCHEME="https"
fi

# Pin every auth flow's returnTo to the LAN URL — without this, opening
# http(s)://localhost:PORT/register on the laptop produces an email with a
# localhost link that the phone resolves to itself ("site can't be reached").
export PACT_AUTH_DEFAULT_RETURN_TO="${SCHEME}://${LAN_IP}:${PORT}/dashboard"

CURL_FLAGS=""
if [[ "${USE_HTTPS}" -eq 1 ]]; then
  CURL_FLAGS=" -k"
fi

cat <<EOM
────────────────────────────────────────────────────────────────────
  Open these on each device:

    On this machine     →  ${SCHEME}://localhost:${PORT}
    On phones / others  →  ${SCHEME}://${LAN_IP}:${PORT}

  Verify-email links will resolve to ${SCHEME}://${LAN_IP}:${PORT}/…
  regardless of which URL you registered from. (Override:
  PACT_AUTH_DEFAULT_RETURN_TO=… before the pnpm command.)

  Quick reachability check from another device:
    curl${CURL_FLAGS} ${SCHEME}://${LAN_IP}:${PORT}/api/health

  If the phone says "site can't be reached":
    1. Same Wi-Fi as the laptop?  (yes? continue)
    2. macOS firewall: System Settings → Network → Firewall. Either
       turn it off, or open it and allow incoming for 'node'.
    3. VPN on the laptop rewriting routes? Disconnect it.
EOM

if [[ "${USE_HTTPS}" -eq 1 ]]; then
  cat <<EOM

  If the phone says "not secure" / cert warning:
    Install the mkcert CA on the phone (mkcert -CAROOT → AirDrop).
EOM
else
  cat <<EOM

  Passkeys WILL NOT work over plain HTTP on a LAN IP — use
  pnpm run dev:https:lan for that.
EOM
fi
echo "────────────────────────────────────────────────────────────────────"

# ---- start Next ------------------------------------------------------------

if [[ "${USE_HTTPS}" -eq 1 ]]; then
  exec env-cmd -f "${ENV_FILE}" next dev --turbopack \
    --experimental-https \
    --experimental-https-cert "${CERT_FILE}" \
    --experimental-https-key "${KEY_FILE}" \
    -H 0.0.0.0 \
    -p "${PORT}"
fi

exec env-cmd -f "${ENV_FILE}" next dev --turbopack \
  -H 0.0.0.0 \
  -p "${PORT}"
