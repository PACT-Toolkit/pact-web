import { http, HttpResponse, type RequestHandler } from 'msw';
import { v4 as uuidv4 } from 'uuid';

import { db } from '@/mocks/data/dbFactory';
import {
  type AuthBeginTOTPEnrollmentResponse,
  type AuthConfirmTOTPEnrollmentRequest,
  type AuthFinishPasskeyRegistrationResponse,
  type AuthListIdentitiesResponse,
  type AuthListMfaFactorsResponse,
  type AuthListPasskeysResponse,
  type AuthLoginRequest,
  type AuthPasskeyCeremonyResponse,
  type AuthRecoveryCodesResponse,
  type AuthRenamePasskeyRequest,
  type AuthSessionIntrospectionResponse,
  type AuthSessionResponse,
} from '@/src/__codegen__/rest/auth';
import { MOCK_USER_ID } from '@/src/framework/helpers/environment';

import {
  MOCK_LOGIN_WRONG_PASSWORD,
  MOCK_SESSION_TOKEN,
  MOCK_WEBAUTHN_CHALLENGE_B64URL,
  MOCK_WEBAUTHN_MFA_FAILING_CREDENTIAL_ID_B64URL,
  MOCK_WEBAUTHN_USER_HANDLE_B64URL,
  mockSessionExpiresAtUnix,
} from '../data/auth';

// Since PACT-681 the server-side pact-auth client (src/framework/auth/
// pact_auth/client.ts) speaks plain fetch to pact-gateway's /v1/auth/* REST
// proxy instead of dialing pact-auth's gRPC port. That fetch runs inside
// Next.js's Node runtime (route handlers, Server Components), which MSW
// intercepts via instrumentation.ts the same way it intercepts browser
// fetches - so, unlike the gRPC client this replaced, it DOES need mocking.
// Every handler below mirrors one method on PactAuthClient (each method's
// `path:` argument names the endpoint it hits).
//
// Session-token handling: dev:mock's auto-login (validateSessionFromCookies
// in session.ts) always returns a synthetic session, so /login itself
// redirects straight to /dashboard and never sets a real pact_session
// cookie. The session-scoped endpoints below (identities, MFA factors,
// passkeys, enrollment) don't check the bearer token's value at all - they
// just answer from the MockRepository rows below - and factors.ts
// (PACT-717) falls back to MOCK_SESSION_TOKEN as the token whenever
// isMock() is true, so a fresh dev:mock session renders the seeded
// passkey and identity below, plus any TOTP factor enrolled during the
// session, without ever calling POST /api/auth/login.

const bearerToken = (request: Request): string | undefined =>
  request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

// Shared by every endpoint that mints or refreshes a session (login,
// password-reset confirm, verify-email, mfa/verify, passkey login finish,
// oauth callback) - one authoritative shape instead of six near-duplicate
// object literals.
const mockSessionResponse = (): AuthSessionResponse => ({
  sessionToken: MOCK_SESSION_TOKEN,
  refreshToken: 'mock-refresh-token',
  userId: MOCK_USER_ID,
  expiresAtUnix: mockSessionExpiresAtUnix(),
  mfaRequired: false,
  mfaToken: '',
  returnTo: '',
});

// Recovery codes are opaque, single-use-per-batch strings on the wire -
// nothing downstream parses their format, so a short random hex string per
// code is as good as pact-auth's real alphabet.
const generateRecoveryCodes = (): string[] =>
  Array.from({ length: 8 }, () => uuidv4().replace(/-/g, '').slice(0, 10));

// pact-auth issues recovery codes exactly once per account - the first time
// it confirms a TOTP enrollment, finishes a passkey registration, or
// answers an explicit regenerate call with no prior batch on file. Every
// other Regenerate/TOTP-confirm call after that mints a fresh batch too
// (that's their whole point), but passkey registration only mints one the
// very first time - see the passkeys/register/finish handler below.
const recoveryCodesIssued = (): boolean =>
  db.authRecoveryCodesState.findFirst(() => true)?.issued ?? false;

const markRecoveryCodesIssued = (): void => {
  db.authRecoveryCodesState.update(
    () => true,
    (s) => ({ ...s, issued: true })
  );
};

export const handlers: RequestHandler[] = [
  http.post('*/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as AuthLoginRequest;
    if (body.password === MOCK_LOGIN_WRONG_PASSWORD) {
      // Mirrors pact-gateway's error envelope (PACT-684) so dev:mock
      // fidelity matches the `code`-slug parsing client.ts does in real
      // mode (PACT-686).
      return HttpResponse.json(
        { code: 'unauthenticated', error: 'invalid email or password' },
        { status: 401 }
      );
    }

    return HttpResponse.json(mockSessionResponse());
  }),

  http.post('*/v1/auth/register', () => HttpResponse.json({})),

  http.post('*/v1/auth/password-reset/request', () => HttpResponse.json({})),

  http.post('*/v1/auth/password-reset/confirm', () =>
    HttpResponse.json(mockSessionResponse())
  ),

  http.post('*/v1/auth/verify-email', () =>
    HttpResponse.json(mockSessionResponse())
  ),

  http.post('*/v1/auth/verify-email/resend', () => HttpResponse.json({})),

  http.post('*/v1/auth/mfa/verify', () =>
    HttpResponse.json(mockSessionResponse())
  ),

  // Alternative to mfa/verify's TOTP/recovery-code step-up (PACT-697). No
  // allowCredentials - same simplification passkeys/login/begin below
  // already makes - so any resident credential a virtual authenticator
  // registers can complete the ceremony.
  http.post('*/v1/auth/mfa/passkey/begin', () =>
    HttpResponse.json({
      ceremonyId: uuidv4(),
      optionsJson: {
        publicKey: {
          challenge: MOCK_WEBAUTHN_CHALLENGE_B64URL,
          timeout: 60_000,
          userVerification: 'preferred',
        },
      },
    } satisfies AuthPasskeyCeremonyResponse)
  ),

  // See MOCK_WEBAUTHN_MFA_FAILING_CREDENTIAL_ID_B64URL's docblock: a
  // credential id matching that sentinel fails exactly like a real
  // assertion pact-auth can't verify. Any other credential id succeeds.
  http.post('*/v1/auth/mfa/passkey/finish', async ({ request }) => {
    const body = (await request.json()) as {
      assertionJson?: { id?: string };
    };
    if (
      body.assertionJson?.id === MOCK_WEBAUTHN_MFA_FAILING_CREDENTIAL_ID_B64URL
    ) {
      return HttpResponse.json(
        { code: 'unauthenticated', error: 'passkey verification failed' },
        { status: 401 }
      );
    }

    return HttpResponse.json(mockSessionResponse());
  }),

  // /api/auth/oauth/start short-circuits before ever calling the pact-auth
  // client when isMock() is true (see pact-dev-mock skill), so this is
  // unreachable via the app today. Handled anyway - if that short-circuit
  // is ever removed, the request lands here instead of a silent gateway
  // passthrough.
  http.get('*/v1/auth/oauth/start', () =>
    HttpResponse.json({
      authorizationUrl: 'https://mock-oauth-provider.local/authorize',
      state: 'mock-oauth-state',
    })
  ),

  // Same story as oauth/start: /v1/auth/callback/[provider]/route.ts
  // short-circuits before calling the client when isMock() is true.
  http.post('*/v1/auth/oauth/callback/:provider', () =>
    HttpResponse.json(mockSessionResponse())
  ),

  http.get('*/v1/auth/session', ({ request }) => {
    const token = bearerToken(request);
    if (token !== MOCK_SESSION_TOKEN) {
      return HttpResponse.json({
        valid: false,
        userId: '',
        expiresAtUnix: 0,
      } satisfies AuthSessionIntrospectionResponse);
    }

    return HttpResponse.json({
      valid: true,
      userId: MOCK_USER_ID,
      expiresAtUnix: mockSessionExpiresAtUnix(),
    } satisfies AuthSessionIntrospectionResponse);
  }),

  http.post('*/v1/auth/logout', () => HttpResponse.json({})),

  http.get('*/v1/auth/identities', () =>
    HttpResponse.json({
      identities: db.authIdentities.getAll(),
    } satisfies AuthListIdentitiesResponse)
  ),

  http.delete('*/v1/auth/identities/:provider', ({ params }) => {
    const { provider } = params as { provider: string };
    db.authIdentities.delete((i) => i.provider === provider);

    return HttpResponse.json({});
  }),

  http.post('*/v1/auth/totp/enroll/begin', () => {
    const factor = db.authMfaFactors.create({
      factorId: uuidv4(),
      type: 'totp',
      label: 'Authenticator app',
      verified: false,
    });

    return HttpResponse.json({
      factorId: factor.factorId,
      secret: 'MOCKSECRETMOCKSECRETMOCK',
      otpauthUrl:
        'otpauth://totp/PACT:mock-user?secret=MOCKSECRETMOCKSECRETMOCK&issuer=PACT',
    } satisfies AuthBeginTOTPEnrollmentResponse);
  }),

  http.post('*/v1/auth/totp/enroll/confirm', async ({ request }) => {
    const body = (await request.json()) as AuthConfirmTOTPEnrollmentRequest;
    db.authMfaFactors.update(
      (f) => f.factorId === body.factorId,
      (f) => ({ ...f, verified: true })
    );
    markRecoveryCodesIssued();

    return HttpResponse.json({
      recoveryCodes: generateRecoveryCodes(),
    } satisfies AuthRecoveryCodesResponse);
  }),

  http.get('*/v1/auth/mfa/factors', () =>
    HttpResponse.json({
      factors: db.authMfaFactors.getAll(),
    } satisfies AuthListMfaFactorsResponse)
  ),

  http.delete('*/v1/auth/mfa/factors/:factorId', ({ params }) => {
    const { factorId } = params as { factorId: string };
    db.authMfaFactors.delete((f) => f.factorId === factorId);

    return HttpResponse.json({});
  }),

  http.post('*/v1/auth/mfa/recovery-codes', () => {
    markRecoveryCodesIssued();

    return HttpResponse.json({
      recoveryCodes: generateRecoveryCodes(),
    } satisfies AuthRecoveryCodesResponse);
  }),

  // rp.id / rpId are deliberately omitted below - the WebAuthn spec
  // defaults them to the calling origin's effective domain, which keeps
  // the ceremony valid whether dev:mock is reached via localhost or
  // 127.0.0.1. See mock/data/auth.ts's docblock on the challenge constants.
  http.post('*/v1/auth/passkeys/register/begin', () =>
    HttpResponse.json({
      ceremonyId: uuidv4(),
      optionsJson: {
        publicKey: {
          rp: { name: 'PACT' },
          user: {
            id: MOCK_WEBAUTHN_USER_HANDLE_B64URL,
            name: 'mock@pact.dev',
            displayName: 'Ada Lovelace',
          },
          challenge: MOCK_WEBAUTHN_CHALLENGE_B64URL,
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          timeout: 60_000,
          attestation: 'none',
        },
      },
    } satisfies AuthPasskeyCeremonyResponse)
  ),

  // The browser can't complete a real attestation without a WebAuthn
  // authenticator (none is wired into dev:mock), so this only ever fires
  // under an automated test harness driving a virtual authenticator. A
  // fresh passkey row is enough to keep that path working end to end.
  //
  // PACT-714: mirrors pact-auth only issuing recovery codes here the first
  // time an account has none at all - recoveryCodes is entirely absent
  // (not an empty array) once markRecoveryCodesIssued() has fired, whether
  // that happened via an earlier passkey enrollment, a TOTP confirm, or an
  // explicit regenerate call.
  http.post('*/v1/auth/passkeys/register/finish', () => {
    const passkey = db.authPasskeys.create({
      passkeyId: uuidv4(),
      label: 'New passkey',
      lastUsedAtUnix: 0,
    });

    const alreadyIssued = recoveryCodesIssued();
    if (!alreadyIssued) markRecoveryCodesIssued();

    return HttpResponse.json({
      credentialId: passkey.passkeyId,
      ...(alreadyIssued ? {} : { recoveryCodes: generateRecoveryCodes() }),
    } satisfies AuthFinishPasskeyRegistrationResponse);
  }),

  // dev:mock's auto-login (validateSessionFromCookies in session.ts) makes
  // /login redirect straight to /dashboard, so AuthLoginForm's
  // conditional-UI passkey probe (webauthn.ts's
  // isConditionalMediationSupported branch) never actually mounts in
  // today's dev:mock walkthrough. Handled anyway, defensively: if that
  // redirect is ever relaxed, or a test harness renders the form directly,
  // this must return a syntactically valid options payload - a 501 here
  // would surface as a visible form error, not just a quiet console
  // warning.
  http.post('*/v1/auth/passkeys/login/begin', () =>
    HttpResponse.json({
      ceremonyId: uuidv4(),
      optionsJson: {
        publicKey: {
          challenge: MOCK_WEBAUTHN_CHALLENGE_B64URL,
          timeout: 60_000,
          userVerification: 'preferred',
        },
      },
    } satisfies AuthPasskeyCeremonyResponse)
  ),

  http.post('*/v1/auth/passkeys/login/finish', () =>
    HttpResponse.json(mockSessionResponse())
  ),

  http.get('*/v1/auth/passkeys', () =>
    HttpResponse.json({
      passkeys: db.authPasskeys.getAll(),
    } satisfies AuthListPasskeysResponse)
  ),

  http.patch('*/v1/auth/passkeys/:passkeyId', async ({ params, request }) => {
    const { passkeyId } = params as { passkeyId: string };
    const body = (await request.json()) as AuthRenamePasskeyRequest;
    db.authPasskeys.update(
      (p) => p.passkeyId === passkeyId,
      (p) => ({ ...p, label: body.label ?? p.label })
    );

    return HttpResponse.json({});
  }),

  http.delete('*/v1/auth/passkeys/:passkeyId', ({ params }) => {
    const { passkeyId } = params as { passkeyId: string };
    db.authPasskeys.delete((p) => p.passkeyId === passkeyId);

    return HttpResponse.json({});
  }),
];
