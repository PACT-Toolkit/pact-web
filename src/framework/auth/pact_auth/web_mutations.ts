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
  passkeyRename: '/api/auth/passkey/rename',
  passkeyDelete: '/api/auth/passkey/delete',
  oauthUnlink: '/api/auth/oauth/unlink',
  mfaRevoke: '/api/auth/mfa/revoke',
  mfaRecoveryCodes: '/api/auth/mfa/recovery-codes',
} as const;

// -- Mutation fetchers -----------------------------------------------------

export type LoginArg = { email: string; password: string };
export const loginFetcher = (url: string, { arg }: { arg: LoginArg }) =>
  postJson<LoginArg>(url, arg, 'Sign in failed. Please try again.');

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
