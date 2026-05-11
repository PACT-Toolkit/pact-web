import { Code, ConnectError } from '@connectrpc/connect';

// Canonical error codes the /api/auth/* routes hand back to the client.
// Forms switch on these (not on HTTP status) to render distinct UI for
// rate-limit vs. validation vs. unknown failures. Keep this in lockstep
// with the union in `web_mutations.ApiError.info.code` consumers.
export const AUTH_ERROR_CODES = {
  validationError: 'validation_error',
  rateLimited: 'rate_limited',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  notFound: 'not_found',
  conflict: 'conflict',
  unavailable: 'unavailable',
  unknown: 'unknown',
} as const;

export type AuthErrorCode =
  (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export type AuthErrorBody = {
  code: AuthErrorCode;
  error: string;
};

export type MappedAuthError = {
  status: number;
  body: AuthErrorBody;
};

const trimRpcPrefix = (msg: string): string =>
  msg.replace(/^rpc error: code = \w+ desc = /, '').trim();

const friendlyRateLimited =
  "You're trying that too often. Please wait a moment and try again.";

// mapPactAuthError turns any error thrown from the connect-node client
// into a consistent `{ status, body }` shape for the /api/auth/* route
// to return. Callers that need to special-case a code (e.g. register's
// AlreadyExists with a domain-specific link block) should branch on the
// ConnectError directly before falling through to this default mapping.
//
// Non-ConnectError values get the generic `unknown` fallback so any
// transport-level surprise (DNS, panic, etc.) doesn't leak into
// rendered UI.
export const mapPactAuthError = (err: unknown): MappedAuthError => {
  if (!(err instanceof ConnectError)) {
    return {
      status: 500,
      body: { code: AUTH_ERROR_CODES.unknown, error: 'Something went wrong.' },
    };
  }
  const raw = trimRpcPrefix(err.rawMessage);
  switch (err.code) {
    case Code.InvalidArgument:
      return {
        status: 400,
        body: {
          code: AUTH_ERROR_CODES.validationError,
          error:
            raw ||
            "We couldn't validate that. Please double-check and try again.",
        },
      };
    case Code.ResourceExhausted:
      return {
        status: 429,
        body: {
          code: AUTH_ERROR_CODES.rateLimited,
          error: friendlyRateLimited,
        },
      };
    case Code.Unauthenticated:
      return {
        status: 401,
        body: {
          code: AUTH_ERROR_CODES.unauthorized,
          error: 'Your session is no longer valid. Please sign in again.',
        },
      };
    case Code.PermissionDenied:
      return {
        status: 403,
        body: {
          code: AUTH_ERROR_CODES.forbidden,
          error: raw || 'You do not have permission to do that.',
        },
      };
    case Code.NotFound:
      return {
        status: 404,
        body: {
          code: AUTH_ERROR_CODES.notFound,
          error: raw || 'Not found.',
        },
      };
    case Code.AlreadyExists:
      return {
        status: 409,
        body: {
          code: AUTH_ERROR_CODES.conflict,
          error: raw || 'That already exists.',
        },
      };
    case Code.Unavailable:
    case Code.DeadlineExceeded:
      return {
        status: 503,
        body: {
          code: AUTH_ERROR_CODES.unavailable,
          error:
            'The sign-in service is briefly unavailable. Please try again.',
        },
      };
    default:
      return {
        status: 500,
        body: {
          code: AUTH_ERROR_CODES.unknown,
          error: 'Something went wrong. Please try again.',
        },
      };
  }
};
