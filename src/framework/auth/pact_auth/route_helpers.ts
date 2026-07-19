import 'server-only';

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { SESSION_COOKIE } from './cookies';

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
