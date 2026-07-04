import 'server-only';

import { NextResponse } from 'next/server';

import { MOCK_USER_ID } from '@/src/framework/helpers/environment';

import {
  MFA_TOKEN_COOKIE,
  MFA_TOKEN_TTL_SECONDS,
  shortLivedCookieOptions,
} from './cookies';

// Dev:mock has no gRPC layer to fake pact-auth's password/MFA responses
// against - MSW only intercepts client-side fetches (see
// src/app/auth/mock/handlers/auth.ts), and /api/auth/* route handlers call
// pact-auth directly over gRPC, so there's nothing for MSW to catch.
//
// To let a developer click through the MFA step-up flow without pact-auth
// running, /api/auth/login and /api/auth/reset-password recognize these
// sentinel values in place of a real email/token and short-circuit to a
// synthetic mfa_required response, mirroring what an MFA-enrolled account
// gets from the real backend. Any other email/token still falls through to
// the real gRPC call, unchanged from today's behavior.

// Login: submit this email (any password) to trigger the mock MFA branch.
export const MOCK_MFA_LOGIN_EMAIL = 'mfa-demo@pact.dev';

// Password reset: use this as the reset token (e.g.
// /reset-password?token=mock-mfa-reset-token) to trigger the mock MFA
// branch instead of hitting pact-auth's ConfirmPasswordReset.
export const MOCK_MFA_RESET_TOKEN = 'mock-mfa-reset-token';

// Placed in the pact_mfa_token cookie by both mock branches above.
// /api/auth/mfa/verify recognizes this value and completes the flow with a
// synthetic session instead of calling pact-auth.VerifyMfa.
export const MOCK_MFA_CHALLENGE_TOKEN = 'mock-mfa-challenge-token';

// Builds the { ok, mfaRequired, userId } response + pact_mfa_token cookie
// that both mock branches return - identical in shape to what
// login/route.ts and reset-password/route.ts build from a real pact-auth
// mfa_required response.
export const mockMfaRequiredResponse = (): NextResponse => {
  const res = NextResponse.json({
    ok: true,
    mfaRequired: true,
    userId: MOCK_USER_ID,
  });
  res.cookies.set({
    name: MFA_TOKEN_COOKIE,
    value: MOCK_MFA_CHALLENGE_TOKEN,
    ...shortLivedCookieOptions(MFA_TOKEN_TTL_SECONDS),
  });

  return res;
};
