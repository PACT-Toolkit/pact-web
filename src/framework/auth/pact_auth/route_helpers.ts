import 'server-only';

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { MFA_TOKEN_COOKIE, SESSION_COOKIE } from './cookies';
import { MFA_STEP_UP_ERROR_CODES } from './errors';

// Request/response boilerplate shared by every /api/auth/* proxy route:
// the session-cookie gate, the JSON body parse, and the string type guard
// each route used to re-declare per file. The response shapes are part of
// the routes' wire contract - forms and settings cards switch on them -
// so they are kept byte-identical to what the routes returned before the
// extraction. Domain-specific validation and ConnectError mapping stay in
// the routes (see errors.ts's mapPactAuthError for the generic mapping).

export const isString = (v: unknown): v is string => typeof v === 'string';

// Parses the JSON request body, or returns null when the payload is
// malformed - pair with invalidJsonResponse().
export const readJsonBody = async <T>(req: NextRequest): Promise<T | null> => {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
};

export const invalidJsonResponse = (): NextResponse =>
  NextResponse.json({ error: 'invalid json' }, { status: 400 });

// Session token off the request's cookie jar, or null when absent - pair
// with notSignedInResponse(). Cookie presence is only the cheap first
// gate; pact-auth still validates the token on the gRPC call itself.
export const getSessionToken = async (): Promise<string | null> =>
  (await cookies()).get(SESSION_COOKIE)?.value ?? null;

export const notSignedInResponse = (): NextResponse =>
  NextResponse.json({ error: 'not signed in' }, { status: 401 });

// The Code.Unauthenticated answer of every session-authenticated settings
// route (passkey rename/delete, MFA enroll/revoke, OAuth unlink, ...).
export const sessionExpiredResponse = (): NextResponse =>
  NextResponse.json({ error: 'session expired' }, { status: 401 });

// -- MFA step-up (verify, passkey/begin, passkey/finish) ------------------
//
// Every /api/auth/mfa/* route reads the outstanding challenge off the same
// httpOnly cookie and answers the same way when it's missing or dead -
// extracted here so mfa/verify, mfa/passkey/begin, and mfa/passkey/finish
// share one implementation instead of three near-identical copies.

// Reads the mfa_token off its httpOnly cookie, returning undefined when
// there's no challenge in progress - pair with noMfaChallengeResponse().
export const getMfaToken = async (): Promise<string | undefined> =>
  (await cookies()).get(MFA_TOKEN_COOKIE)?.value;

export const noMfaChallengeResponse = (): NextResponse =>
  NextResponse.json(
    {
      error: 'No sign-in in progress. Start again from the login page.',
      code: MFA_STEP_UP_ERROR_CODES.noChallenge,
    },
    { status: 401 }
  );

// pact-auth packs two distinct outcomes under Code.Unauthenticated for
// every mfa_token-scoped RPC: the challenge itself is dead (revoked,
// expired, or already consumed - mfa.ErrChallengeInvalid) versus a
// live-challenge verification failure (wrong TOTP code, failed passkey
// assertion). Classifying by raw message is how every /api/auth/mfa/*
// route tells them apart - see MapMfaErr in
// pact-auth/internal/features/mfa/errors.go.
export const isChallengeGoneMessage = (raw: string): boolean => {
  const lower = raw.toLowerCase();

  return lower.includes('challenge') || lower.includes('expired');
};

// The 401 for a dead mfa_token: always clears the cookie, since the
// challenge is already unusable server-side by the time this fires (either
// it was dead before the call, or - for a passkey assertion that verified
// against the wrong challenge - the call itself is what just killed it; see
// FinishMfaPasskeyAssertion's docblock).
export const challengeExpiredResponse = (): NextResponse => {
  const res = NextResponse.json(
    {
      error: 'Your sign-in attempt expired. Enter your password again.',
      code: MFA_STEP_UP_ERROR_CODES.challengeExpired,
    },
    { status: 401 }
  );
  res.cookies.delete(MFA_TOKEN_COOKIE);

  return res;
};

// -- WebAuthn ceremony options ----------------------------------------------

// Parses a WebAuthn ceremony's raw options bytes (as returned by every
// PactAuthClient begin* method) into the JSON shape
// navigator.credentials.{create,get} expects. go-webauthn marshals both
// CredentialCreation and CredentialAssertion as { publicKey: {...},
// mediation? } - unwrap so the browser-side decoder reads
// challenge/allowCredentials (or user/pubKeyCredParams) directly off the
// top instead of juggling either the wrapped or the bare shape.
export const parseCeremonyOptions = (
  bytes: Uint8Array
): { ok: true; options: unknown } | { ok: false } => {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as
      | { publicKey?: unknown }
      | unknown;
    const options =
      parsed && typeof parsed === 'object' && 'publicKey' in parsed
        ? (parsed as { publicKey: unknown }).publicKey
        : parsed;

    return { ok: true, options };
  } catch {
    return { ok: false };
  }
};
