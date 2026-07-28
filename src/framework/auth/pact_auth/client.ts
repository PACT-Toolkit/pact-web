import 'server-only';

import { Code, ConnectError } from '@connectrpc/connect';
import { headers as nextHeaders } from 'next/headers';

import {
  type AuthBeginTOTPEnrollmentResponse,
  type AuthListIdentitiesResponse,
  type AuthListMfaFactorsResponse,
  type AuthListPasskeysResponse,
  type AuthPasskeyCeremonyResponse,
  type AuthRecoveryCodesResponse,
  type AuthSessionIntrospectionResponse,
  type AuthSessionResponse,
  type AuthStartLoginResponse,
} from '@/src/__codegen__/rest/auth/types';
import { appendForwardedFor, inboundClientIp } from '@/src/lib/proxy/client_ip';
import { getGatewayBaseUrl } from '@/src/lib/proxy/gateway_url';

// Server-side pact-auth client. Speaks REST/JSON against pact-gateway's
// /v1/auth/* proxy (PACT_GATEWAY_URL) instead of dialing pact-auth's gRPC
// port directly - the mesh-mTLS rollout closed that listener to allowlisted
// workloads, so pact-web's plaintext connect-node dial started failing at
// the TLS preface. See PACT-681.
//
// The wire types imported above come from the auth REST codegen
// (`schema/auth/`, `pnpm run rest:codegen`), which mirrors pact-gateway's
// own `api/swagger/auth.yaml` - the same "gateway owns a per-tag swagger
// slice" convention already used for benchmark/check/classifier/etc. Only
// the generated *types* are used here: the generated fetchers/hooks in
// `src/__codegen__/rest/auth/{fetchers,hooks}.ts` target the browser-facing
// `/api/pact/gateway/v1/*` catch-all proxy and have no way to attach a
// caller-supplied bearer token, which every session-authed method below
// needs (the caller passes the token as a plain argument, not a cookie).
//
// The one exception is the end-user client IP (PACT-687): authRequest
// reads it from `next/headers` via inboundRequestHeaders() below, purely
// to forward it on to pact-gateway (see the X-Forwarded-For comment on
// authRequest). That read is wrapped so it is a clean no-op outside an
// active request scope, which is what keeps this module's original
// testability property intact - none of the tests in client.test.ts need
// to mock `next/headers` to exercise the request-building logic.
//
// Every method here preserves the exact name, argument shape, and
// zero-valued-field return shape the old protobuf-backed client had, so
// none of the 20+ route handlers under app/api/auth/** (or session.ts /
// factors.ts) needed to change.
//
// Never import this from a Client Component - the `server-only` import
// enforces it at build time.

const AUTH_BASE_PATH = '/v1/auth';

// Inverse of pact-gateway's HTTPStatusFromGRPC
// (internal/boundary/boundary.go). Necessarily lossy in one place:
// InvalidArgument, FailedPrecondition, and OutOfRange all collapse to 400
// on the wire, so a 400 here always decodes back to InvalidArgument even
// when the upstream gRPC code was one of the other two. Route handlers
// that used to branch on Code.FailedPrecondition (login's "email not
// verified", mfa/enroll/begin's "already enrolled", mfa/recovery-codes's
// "enroll TOTP first") fall through to the generic InvalidArgument mapping
// as a result - a confirmed, gateway-side limitation, not something this
// module can recover client-side. Same story for Canceled vs
// DeadlineExceeded on 504.
const httpStatusToCode = (status: number): Code => {
  switch (status) {
    case 400:
      return Code.InvalidArgument;
    case 401:
      return Code.Unauthenticated;
    case 403:
      return Code.PermissionDenied;
    case 404:
      return Code.NotFound;
    case 409:
      return Code.AlreadyExists;
    case 429:
      return Code.ResourceExhausted;
    case 501:
      return Code.Unimplemented;
    case 503:
      return Code.Unavailable;
    case 504:
      return Code.DeadlineExceeded;
    default:
      return Code.Unknown;
  }
};

// Best-effort read of the inbound request's headers via next/headers.
// `headers()` throws (or is simply unavailable) outside an active request
// scope - build time, unit tests, and any script that imports this module
// directly - and none of those cases should ever fail or block an auth
// request, so every failure mode collapses to "no headers available".
const inboundRequestHeaders = async (): Promise<Headers | undefined> => {
  try {
    return await nextHeaders();
  } catch {
    return undefined;
  }
};

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type AuthRequestOptions = {
  method: Method;
  path: string;
  // Bearer token for session-authed endpoints. Omit for the public ones
  // (login, register, password-reset, etc).
  sessionToken?: string;
  body?: unknown;
  query?: Record<string, string | undefined>;
};

// Shared fetch wrapper for every /v1/auth/* call. Throws a ConnectError
// with a mapped `Code` on any non-2xx response or network failure, so
// mapPactAuthError() and every route handler's `instanceof ConnectError` /
// `err.code` branch keep working unmodified.
const authRequest = async <T>(opts: AuthRequestOptions): Promise<T> => {
  const url = new URL(`${AUTH_BASE_PATH}${opts.path}`, getGatewayBaseUrl());
  if (opts.query) {
    for (const [key, value] of Object.entries(opts.query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }

  const headers = new Headers();
  if (opts.body !== undefined) headers.set('content-type', 'application/json');
  if (opts.sessionToken) {
    headers.set('authorization', `Bearer ${opts.sessionToken}`);
  }

  // Forward the end-user's client IP to pact-gateway (PACT-687), which
  // keys its per-IP rate buckets on the right-most X-Forwarded-For hop
  // under PACT_TRUST_XFF=true. pact-web is the gateway's single trusted
  // proxy hop (trustedProxyHops=1), so exactly one hop is appended here -
  // never more, and never replacing a value already on this (freshly
  // built) outbound header. The inbound request scope may be unavailable
  // (see inboundRequestHeaders above), in which case no header is set and
  // the request proceeds exactly as it did before this change.
  const inbound = await inboundRequestHeaders();
  if (inbound) {
    const clientIp = inboundClientIp(inbound);
    const forwardedFor = appendForwardedFor(
      headers.get('x-forwarded-for'),
      clientIp
    );
    if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (cause) {
    throw new ConnectError(
      'pact-gateway unreachable',
      Code.Unavailable,
      undefined,
      undefined,
      cause
    );
  }

  const text = await res.text();

  if (!res.ok) {
    throw new ConnectError(
      text || res.statusText,
      httpStatusToCode(res.status)
    );
  }

  return (text ? JSON.parse(text) : undefined) as T;
};

// -- Response shapes ----------------------------------------------------
//
// pact-gateway reuses a single auth.SessionResponse definition across every
// session-issuing endpoint (login, confirmPasswordReset, verifyEmail,
// verifyMfa, handleCallback, finishPasskeyLogin) - mirrored below as one
// local shape, normalised to the same never-undefined fields the old
// protobuf messages always returned (protobuf has no concept of an absent
// scalar; REST/JSON does).

export type AuthSessionResult = {
  sessionToken: string;
  refreshToken: string;
  userId: string;
  expiresAtUnix: number;
  mfaRequired: boolean;
  mfaToken: string;
  returnTo: string;
};

const toSessionResult = (raw: AuthSessionResponse): AuthSessionResult => ({
  sessionToken: raw.sessionToken ?? '',
  refreshToken: raw.refreshToken ?? '',
  userId: raw.userId ?? '',
  expiresAtUnix: raw.expiresAtUnix ?? 0,
  mfaRequired: raw.mfaRequired ?? false,
  mfaToken: raw.mfaToken ?? '',
  returnTo: raw.returnTo ?? '',
});

export type AuthSessionIntrospectionResult = {
  valid: boolean;
  userId: string;
  expiresAtUnix: number;
};

const toIntrospectionResult = (
  raw: AuthSessionIntrospectionResponse
): AuthSessionIntrospectionResult => ({
  valid: raw.valid ?? false,
  userId: raw.userId ?? '',
  expiresAtUnix: raw.expiresAtUnix ?? 0,
});

export type AuthStartLoginResult = {
  authorizationUrl: string;
  state: string;
};

export type AuthMfaFactorsResult = {
  factors: {
    factorId: string;
    type: string;
    label: string;
    verified: boolean;
    createdAtUnix: number;
  }[];
};

export type AuthPasskeysResult = {
  passkeys: {
    passkeyId: string;
    label: string;
    createdAtUnix: number;
    lastUsedAtUnix: number;
  }[];
};

export type AuthIdentitiesResult = {
  identities: {
    provider: string;
    providerUid: string;
    connectedAtUnix: number;
  }[];
};

export type AuthBeginTOTPEnrollmentResult = {
  factorId: string;
  secret: string;
  otpauthUrl: string;
};

export type AuthRecoveryCodesResult = {
  recoveryCodes: string[];
};

export type AuthPasskeyCeremonyResult = {
  ceremonyId: string;
  // pact-auth's go-webauthn options are raw JSON on pact-gateway's wire.
  // Kept as bytes here (encoded below) so the four passkey route handlers
  // - which already do
  // `JSON.parse(new TextDecoder().decode(resp.optionsJson))` - don't need
  // to change.
  optionsJson: Uint8Array;
};

const toCeremonyResult = (
  raw: AuthPasskeyCeremonyResponse
): AuthPasskeyCeremonyResult => ({
  ceremonyId: raw.ceremonyId ?? '',
  optionsJson: new TextEncoder().encode(JSON.stringify(raw.optionsJson ?? {})),
});

export type AuthFinishPasskeyRegistrationResult = {
  credentialId: string;
};

// -- Client ---------------------------------------------------------------

export interface PactAuthClient {
  login(req: { email: string; password: string }): Promise<AuthSessionResult>;
  register(req: {
    email: string;
    password: string;
    displayName: string;
    returnTo: string;
  }): Promise<void>;
  requestPasswordReset(req: { email: string; returnTo: string }): Promise<void>;
  confirmPasswordReset(req: {
    token: string;
    newPassword: string;
  }): Promise<AuthSessionResult>;
  verifyEmail(req: { token: string }): Promise<AuthSessionResult>;
  resendVerification(req: { email: string; returnTo: string }): Promise<void>;
  verifyMfa(req: {
    mfaToken: string;
    code: string;
    isRecovery: boolean;
  }): Promise<AuthSessionResult>;
  startLogin(req: {
    provider: string;
    returnTo: string;
  }): Promise<AuthStartLoginResult>;
  handleCallback(req: {
    provider: string;
    code: string;
    state: string;
    signedState: string;
  }): Promise<AuthSessionResult>;
  validateSession(req: {
    sessionToken: string;
  }): Promise<AuthSessionIntrospectionResult>;
  revokeSession(req: { sessionToken: string }): Promise<void>;
  listIdentities(req: { sessionToken: string }): Promise<AuthIdentitiesResult>;
  unlinkIdentity(req: {
    sessionToken: string;
    provider: string;
  }): Promise<void>;
  beginTOTPEnrollment(req: {
    sessionToken: string;
  }): Promise<AuthBeginTOTPEnrollmentResult>;
  confirmTOTPEnrollment(req: {
    sessionToken: string;
    factorId: string;
    code: string;
  }): Promise<AuthRecoveryCodesResult>;
  listMfaFactors(req: { sessionToken: string }): Promise<AuthMfaFactorsResult>;
  revokeMfaFactor(req: {
    sessionToken: string;
    factorId: string;
  }): Promise<void>;
  regenerateRecoveryCodes(req: {
    sessionToken: string;
  }): Promise<AuthRecoveryCodesResult>;
  beginPasskeyRegistration(req: {
    sessionToken: string;
    label: string;
  }): Promise<AuthPasskeyCeremonyResult>;
  finishPasskeyRegistration(req: {
    sessionToken: string;
    ceremonyId: string;
    attestationJson: Uint8Array;
  }): Promise<AuthFinishPasskeyRegistrationResult>;
  beginPasskeyLogin(req: { email: string }): Promise<AuthPasskeyCeremonyResult>;
  finishPasskeyLogin(req: {
    ceremonyId: string;
    assertionJson: Uint8Array;
  }): Promise<AuthSessionResult>;
  listPasskeys(req: { sessionToken: string }): Promise<AuthPasskeysResult>;
  renamePasskey(req: {
    sessionToken: string;
    passkeyId: string;
    label: string;
  }): Promise<void>;
  deletePasskey(req: {
    sessionToken: string;
    passkeyId: string;
  }): Promise<void>;
}

// Decodes the Uint8Array shape the four passkey route handlers build via
// `new TextEncoder().encode(JSON.stringify(...))` back into the plain JSON
// object pact-gateway's wire format expects.
const decodeCeremonyJson = (bytes: Uint8Array): unknown =>
  JSON.parse(new TextDecoder().decode(bytes));

let cached: PactAuthClient | undefined;

export const getPactAuthClient = (): PactAuthClient => {
  if (cached) return cached;

  cached = {
    login: async ({ email, password }) =>
      toSessionResult(
        await authRequest<AuthSessionResponse>({
          method: 'POST',
          path: '/login',
          body: { email, password },
        })
      ),

    register: async ({ email, password, displayName, returnTo }) => {
      await authRequest<void>({
        method: 'POST',
        path: '/register',
        body: { email, password, displayName, returnTo },
      });
    },

    requestPasswordReset: async ({ email, returnTo }) => {
      await authRequest<void>({
        method: 'POST',
        path: '/password-reset/request',
        body: { email, returnTo },
      });
    },

    confirmPasswordReset: async ({ token, newPassword }) =>
      toSessionResult(
        await authRequest<AuthSessionResponse>({
          method: 'POST',
          path: '/password-reset/confirm',
          body: { token, newPassword },
        })
      ),

    verifyEmail: async ({ token }) =>
      toSessionResult(
        await authRequest<AuthSessionResponse>({
          method: 'POST',
          path: '/verify-email',
          body: { token },
        })
      ),

    resendVerification: async ({ email, returnTo }) => {
      await authRequest<void>({
        method: 'POST',
        path: '/verify-email/resend',
        body: { email, returnTo },
      });
    },

    verifyMfa: async ({ mfaToken, code, isRecovery }) =>
      toSessionResult(
        await authRequest<AuthSessionResponse>({
          method: 'POST',
          path: '/mfa/verify',
          body: { mfaToken, code, isRecovery },
        })
      ),

    startLogin: async ({ provider, returnTo }) => {
      const raw = await authRequest<AuthStartLoginResponse>({
        method: 'GET',
        path: '/oauth/start',
        query: { provider, returnTo },
      });

      return {
        authorizationUrl: raw.authorizationUrl ?? '',
        state: raw.state ?? '',
      };
    },

    handleCallback: async ({ provider, code, state, signedState }) =>
      toSessionResult(
        await authRequest<AuthSessionResponse>({
          method: 'POST',
          path: `/oauth/callback/${encodeURIComponent(provider)}`,
          body: { code, state, signedState },
        })
      ),

    validateSession: async ({ sessionToken }) =>
      toIntrospectionResult(
        await authRequest<AuthSessionIntrospectionResponse>({
          method: 'GET',
          path: '/session',
          sessionToken,
        })
      ),

    revokeSession: async ({ sessionToken }) => {
      await authRequest<void>({
        method: 'POST',
        path: '/logout',
        sessionToken,
      });
    },

    listIdentities: async ({ sessionToken }) => {
      const raw = await authRequest<AuthListIdentitiesResponse>({
        method: 'GET',
        path: '/identities',
        sessionToken,
      });

      return {
        identities: (raw.identities ?? []).map((i) => ({
          provider: i.provider ?? '',
          providerUid: i.providerUid ?? '',
          connectedAtUnix: i.connectedAtUnix ?? 0,
        })),
      };
    },

    unlinkIdentity: async ({ sessionToken, provider }) => {
      await authRequest<void>({
        method: 'DELETE',
        path: `/identities/${encodeURIComponent(provider)}`,
        sessionToken,
      });
    },

    beginTOTPEnrollment: async ({ sessionToken }) => {
      const raw = await authRequest<AuthBeginTOTPEnrollmentResponse>({
        method: 'POST',
        path: '/totp/enroll/begin',
        sessionToken,
      });

      return {
        factorId: raw.factorId ?? '',
        secret: raw.secret ?? '',
        otpauthUrl: raw.otpauthUrl ?? '',
      };
    },

    confirmTOTPEnrollment: async ({ sessionToken, factorId, code }) => {
      const raw = await authRequest<AuthRecoveryCodesResponse>({
        method: 'POST',
        path: '/totp/enroll/confirm',
        sessionToken,
        body: { factorId, code },
      });

      return { recoveryCodes: raw.recoveryCodes ?? [] };
    },

    listMfaFactors: async ({ sessionToken }) => {
      const raw = await authRequest<AuthListMfaFactorsResponse>({
        method: 'GET',
        path: '/mfa/factors',
        sessionToken,
      });

      return {
        factors: (raw.factors ?? []).map((f) => ({
          factorId: f.factorId ?? '',
          type: f.type ?? '',
          label: f.label ?? '',
          verified: f.verified ?? false,
          createdAtUnix: f.createdAtUnix ?? 0,
        })),
      };
    },

    revokeMfaFactor: async ({ sessionToken, factorId }) => {
      await authRequest<void>({
        method: 'DELETE',
        path: `/mfa/factors/${encodeURIComponent(factorId)}`,
        sessionToken,
      });
    },

    regenerateRecoveryCodes: async ({ sessionToken }) => {
      const raw = await authRequest<AuthRecoveryCodesResponse>({
        method: 'POST',
        path: '/mfa/recovery-codes',
        sessionToken,
      });

      return { recoveryCodes: raw.recoveryCodes ?? [] };
    },

    beginPasskeyRegistration: async ({ sessionToken, label }) =>
      toCeremonyResult(
        await authRequest<AuthPasskeyCeremonyResponse>({
          method: 'POST',
          path: '/passkeys/register/begin',
          sessionToken,
          body: { label },
        })
      ),

    finishPasskeyRegistration: async ({
      sessionToken,
      ceremonyId,
      attestationJson,
    }) => {
      const raw = await authRequest<{ credentialId?: string }>({
        method: 'POST',
        path: '/passkeys/register/finish',
        sessionToken,
        body: {
          ceremonyId,
          attestationJson: decodeCeremonyJson(attestationJson),
        },
      });

      return { credentialId: raw.credentialId ?? '' };
    },

    beginPasskeyLogin: async ({ email }) =>
      toCeremonyResult(
        await authRequest<AuthPasskeyCeremonyResponse>({
          method: 'POST',
          path: '/passkeys/login/begin',
          body: { email },
        })
      ),

    finishPasskeyLogin: async ({ ceremonyId, assertionJson }) =>
      toSessionResult(
        await authRequest<AuthSessionResponse>({
          method: 'POST',
          path: '/passkeys/login/finish',
          body: {
            ceremonyId,
            assertionJson: decodeCeremonyJson(assertionJson),
          },
        })
      ),

    listPasskeys: async ({ sessionToken }) => {
      const raw = await authRequest<AuthListPasskeysResponse>({
        method: 'GET',
        path: '/passkeys',
        sessionToken,
      });

      return {
        passkeys: (raw.passkeys ?? []).map((p) => ({
          passkeyId: p.passkeyId ?? '',
          label: p.label ?? '',
          createdAtUnix: p.createdAtUnix ?? 0,
          lastUsedAtUnix: p.lastUsedAtUnix ?? 0,
        })),
      };
    },

    renamePasskey: async ({ sessionToken, passkeyId, label }) => {
      await authRequest<void>({
        method: 'PATCH',
        path: `/passkeys/${encodeURIComponent(passkeyId)}`,
        sessionToken,
        body: { label },
      });
    },

    deletePasskey: async ({ sessionToken, passkeyId }) => {
      await authRequest<void>({
        method: 'DELETE',
        path: `/passkeys/${encodeURIComponent(passkeyId)}`,
        sessionToken,
      });
    },
  };

  return cached;
};
