// Client-side fetchers for the /api/auth/* proxy routes. These are the
// functions you hand to `useSWRMutation` from settings cards and auth
// forms — keeping them centralized means:
//
//   1. Every consumer benefits from the same JSON-error contract
//      (`ApiError` carries the HTTP status and the parsed body).
//   2. Endpoint URLs live in one file: changing a route doesn't fan
//      out across components.
//
// Per the SWR conventions (see .agents/skills/swr-best-practices/rules/
// fetcher-throw-on-error.md), every fetcher MUST throw on non-2xx so
// `useSWRMutation`'s `error` field is populated.

export class ApiError extends Error {
  readonly status: number;
  readonly info: { error?: string; code?: string } | null;

  constructor(
    status: number,
    info: { error?: string; code?: string } | null,
    fallback: string
  ) {
    super(info?.error ?? fallback);
    this.name = 'ApiError';
    this.status = status;
    this.info = info;
  }
}

const postJson = async <TBody, TResp = void>(
  url: string,
  body: TBody | undefined,
  fallbackError: string
): Promise<TResp> => {
  const init: RequestInit = { method: 'POST' };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  if (!res.ok) {
    const info = (await res.json().catch(() => null)) as {
      error?: string;
      code?: string;
    } | null;
    throw new ApiError(res.status, info, fallbackError);
  }
  if (res.status === 204) return undefined as TResp;

  // Some endpoints return only `{ ok: true }` — callers that need a real
  // payload pass a non-void TResp; callers that don't ignore it.
  return (await res.json().catch(() => undefined)) as TResp;
};

// -- Cache keys ------------------------------------------------------------
// Every endpoint a hook can hit is exported as a stable string so consumers
// pass the same `key` to `useSWRMutation`. The settings panel doesn't
// `useSWR` these (it reads via RSC), but having the keys here keeps the
// hook call sites uniform with the rest of the app.
export const AUTH_KEYS = {
  login: '/api/auth/login',
  register: '/api/auth/register',
  forgotPassword: '/api/auth/forgot-password',
  resetPassword: '/api/auth/reset-password',
  resendVerification: '/api/auth/resend-verification',
  passkeyRename: '/api/auth/passkey/rename',
  passkeyDelete: '/api/auth/passkey/delete',
  oauthUnlink: '/api/auth/oauth/unlink',
  mfaRevoke: '/api/auth/mfa/revoke',
  mfaRecoveryCodes: '/api/auth/mfa/recovery-codes',
  mfaEnrollBegin: '/api/auth/mfa/enroll/begin',
  mfaEnrollConfirm: '/api/auth/mfa/enroll/confirm',
  mfaVerify: '/api/auth/mfa/verify',
} as const;

// -- Mutation fetchers -----------------------------------------------------

// Collapses a thrown fetcher error into the { code, message } shape the
// auth forms keep in state: ApiError carries the route's { code, error }
// body (postJson already applied the fallback message); anything else is a
// network-level failure.
export const apiErrorToFormError = (
  err: unknown
): { code: string | null; message: string } =>
  err instanceof ApiError
    ? { code: err.info?.code ?? null, message: err.message }
    : { code: null, message: 'Network error. Please try again.' };

export type LoginArg = { email: string; password: string };
// When the user has a verified TOTP factor, pact-auth refuses to return a
// session and instead asks us to bounce through /login/mfa. The route
// sets pact_mfa_token as an httpOnly cookie and returns mfaRequired=true
// in the body so the form knows to navigate instead of routing to /dashboard.
export type LoginResult = { mfaRequired?: boolean; userId?: string };
export const loginFetcher = (
  url: string,
  { arg }: { arg: LoginArg }
): Promise<LoginResult> =>
  postJson<LoginArg, LoginResult>(
    url,
    arg,
    'Sign in failed. Please try again.'
  );

// The register route reads the proto wire name `display_name` (it also
// accepts `displayName`; the form sends the wire name).
export type RegisterArg = {
  email: string;
  password: string;
  display_name: string;
};
export const registerFetcher = (
  url: string,
  { arg }: { arg: RegisterArg }
): Promise<void> =>
  postJson<RegisterArg>(url, arg, 'Registration failed. Please try again.');

export type ForgotPasswordArg = { email: string };
export const forgotPasswordFetcher = (
  url: string,
  { arg }: { arg: ForgotPasswordArg }
): Promise<void> =>
  postJson<ForgotPasswordArg>(url, arg, 'Request failed. Please try again.');

export type ResendVerificationArg = { email: string };
export const resendVerificationFetcher = (
  url: string,
  { arg }: { arg: ResendVerificationArg }
): Promise<void> =>
  postJson<ResendVerificationArg>(
    url,
    arg,
    "Couldn't resend. Please try again later."
  );

// Mirrors LoginResult: when the resetting user still has a verified MFA
// factor, pact-auth withholds the session and the form must bounce
// through /login/mfa instead of navigating to /dashboard.
export type ResetPasswordArg = { token: string; password: string };
export type ResetPasswordResult = { mfaRequired?: boolean; userId?: string };
export const resetPasswordFetcher = (
  url: string,
  { arg }: { arg: ResetPasswordArg }
): Promise<ResetPasswordResult> =>
  postJson<ResetPasswordArg, ResetPasswordResult>(
    url,
    arg,
    'Reset failed. Please try again.'
  );

export type RenamePasskeyArg = { passkeyId: string; label: string };
export const renamePasskeyFetcher = (
  url: string,
  { arg }: { arg: RenamePasskeyArg }
) => postJson<RenamePasskeyArg>(url, arg, 'Could not rename passkey.');

export type DeletePasskeyArg = { passkeyId: string };
export const deletePasskeyFetcher = (
  url: string,
  { arg }: { arg: DeletePasskeyArg }
) => postJson<DeletePasskeyArg>(url, arg, 'Could not remove passkey.');

export type UnlinkIdentityArg = { provider: string };
export const unlinkIdentityFetcher = (
  url: string,
  { arg }: { arg: UnlinkIdentityArg }
) => postJson<UnlinkIdentityArg>(url, arg, 'Could not disconnect provider.');

export type RevokeFactorArg = { factorId: string };
export const revokeFactorFetcher = (
  url: string,
  { arg }: { arg: RevokeFactorArg }
) => postJson<RevokeFactorArg>(url, arg, 'Could not revoke factor.');

// /api/auth/mfa/recovery-codes takes no body — `useSWRMutation` always
// supplies an `arg`, but here we ignore it.
export type RegenerateRecoveryCodesResult = { recoveryCodes: string[] };
export const regenerateRecoveryCodesFetcher = (
  url: string
): Promise<RegenerateRecoveryCodesResult> =>
  postJson<undefined, RegenerateRecoveryCodesResult>(
    url,
    undefined,
    'Could not generate recovery codes.'
  );

// /api/auth/mfa/enroll/begin — provision a pending TOTP factor. No body;
// reads the session cookie server-side. Returns the secret + otpauth URL
// the UI displays for QR-code / manual entry into an authenticator app.
export type BeginTotpEnrollmentResult = {
  factorId: string;
  secret: string;
  otpauthUrl: string;
};
export const beginTotpEnrollmentFetcher = (
  url: string
): Promise<BeginTotpEnrollmentResult> =>
  postJson<undefined, BeginTotpEnrollmentResult>(
    url,
    undefined,
    'Could not start authenticator enrollment.'
  );

// /api/auth/mfa/verify — completes the password+TOTP login flow. The
// route picks the challenge token off the pact_mfa_token cookie, so the
// only thing the client needs to send is the code itself (TOTP or
// recovery). On success the response sets pact_session and the form
// navigates to /dashboard.
export type VerifyMfaArg = { code: string; isRecovery?: boolean };
export const verifyMfaFetcher = (url: string, { arg }: { arg: VerifyMfaArg }) =>
  postJson<VerifyMfaArg>(url, arg, 'Could not verify the code.');

// /api/auth/mfa/enroll/confirm — verify the 6-digit code, flip the
// factor to verified, and return a fresh batch of recovery codes.
export type ConfirmTotpEnrollmentArg = { factorId: string; code: string };
export type ConfirmTotpEnrollmentResult = { recoveryCodes: string[] };
export const confirmTotpEnrollmentFetcher = (
  url: string,
  { arg }: { arg: ConfirmTotpEnrollmentArg }
): Promise<ConfirmTotpEnrollmentResult> =>
  postJson<ConfirmTotpEnrollmentArg, ConfirmTotpEnrollmentResult>(
    url,
    arg,
    'Could not confirm authenticator code.'
  );
