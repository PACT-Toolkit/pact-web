import { type DB } from '@/mocks/data/dbFactory';
import {
  type AuthMfaFactorResponse,
  type AuthOAuthIdentityResponse,
  type AuthPasskeyResponse,
} from '@/src/__codegen__/rest/auth';
import { MOCK_USER_ID } from '@/src/framework/helpers/environment';

// The pact-gateway session token every successful mock */v1/auth/* response
// carries. Same literal src/framework/auth/pact_auth/mock.ts's
// mockSessionCookie() puts in the pact_session cookie for its own
// route-handler-level short circuits (MFA sentinel login, mock OAuth
// callback) - kept as an independent constant rather than imported because
// mock.ts is 'server-only' and these MSW handlers also run in the browser
// bundle (mocks/browser.ts). Matching the literal just means a session
// established through either mock layer looks the same to anything that
// reads the cookie value.
export const MOCK_SESSION_TOKEN = 'mock-session-token';

// Submitting this as the password on /login fails deterministically with a
// 401, so the sign-in form's invalid-credentials branch is exercisable in
// dev:mock without a real pact-gateway. Any other password succeeds -
// dev:mock has no per-user password store to check against.
export const MOCK_LOGIN_WRONG_PASSWORD = 'wrong-password';

const nowUnix = (): number => Math.floor(Date.now() / 1000);

// A function (not a fixed constant) so every call recomputes from the
// current time - a session minted hours into a long-running dev:mock
// session never looks expired.
export const mockSessionExpiresAtUnix = (): number =>
  nowUnix() + 365 * 24 * 60 * 60;

// WebAuthn challenges are opaque bytes on the wire (base64url per the
// WebAuthn JSON serialization spec) - the mock ceremonies never get a real
// authenticator response to verify, so a fixed value is as good as a random
// one. `rp.id` / `rpId` are deliberately omitted from the options built in
// mock/handlers/auth.ts: the spec defaults them to the calling origin's
// effective domain, which keeps the ceremony valid whether dev:mock is
// reached via localhost or 127.0.0.1.
export const MOCK_WEBAUTHN_CHALLENGE_B64URL =
  'bW9jay13ZWJhdXRobi1jaGFsbGVuZ2UtMDAwMDAw';
export const MOCK_WEBAUTHN_USER_HANDLE_B64URL =
  'bW9jay11c2VyLWhhbmRsZS0wMDAwMDA';

export const mockAuthMfaFactor = (
  overrides: Partial<AuthMfaFactorResponse>
): AuthMfaFactorResponse => ({
  factorId: '',
  type: 'totp',
  label: '',
  verified: false,
  createdAtUnix: nowUnix(),
  ...overrides,
});

export const mockAuthPasskey = (
  overrides: Partial<AuthPasskeyResponse>
): AuthPasskeyResponse => ({
  passkeyId: '',
  label: '',
  createdAtUnix: nowUnix(),
  lastUsedAtUnix: 0,
  ...overrides,
});

export const mockAuthIdentity = (
  overrides: Partial<AuthOAuthIdentityResponse>
): AuthOAuthIdentityResponse => ({
  provider: '',
  providerUid: '',
  connectedAtUnix: nowUnix(),
  ...overrides,
});

// Seeds one row per credential-management surface that doesn't gate its own
// "add" entry point on existing rows, so the account security settings page
// has something to show and revoke/rename/disconnect flows have a target -
// matching the account.ts seeder's "non-empty by default" convention.
//
// Deliberately NOT seeding a verified TOTP factor here:
// AuthSettingsTwoFactorCard hides its "Add authenticator app" button
// whenever hasVerifiedTotp is true (see AuthSettingsTwoFactorCard.tsx), so a
// pre-seeded verified factor would permanently hide that button and make the
// totp/enroll/begin and totp/enroll/confirm handlers below unreachable
// through the UI in dev:mock. Passkeys and connected identities have no
// equivalent gate - their register/connect buttons render regardless of
// existing rows - so they are safe to seed non-empty.
export const createAuthMockData = (db: DB): void => {
  db.authPasskeys.create({
    passkeyId: 'mock-passkey-1',
    label: 'MacBook Touch ID',
    createdAtUnix: nowUnix() - 14 * 24 * 60 * 60,
    lastUsedAtUnix: nowUnix() - 2 * 24 * 60 * 60,
  });

  db.authIdentities.create({
    provider: 'github',
    providerUid: MOCK_USER_ID,
    connectedAtUnix: nowUnix() - 60 * 24 * 60 * 60,
  });
};
