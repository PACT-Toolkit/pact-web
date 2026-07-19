import 'server-only';

import { cookies } from 'next/headers';

import { getPactAuthClient } from './client';
import { SESSION_COOKIE } from './cookies';

// Server-only readers for the security settings page. Each function fails
// closed: when pact-auth is unreachable or the session is invalid we
// return an empty list and let the page render in an unconfigured state
// rather than 500 the whole route.

export type MfaFactorView = {
  factorId: string;
  type: string;
  label: string;
  verified: boolean;
  createdAt: Date;
};

// listMfaFactors returns the authenticator-app (TOTP) factors only.
// Passkeys are stored in the same table on the backend but the settings
// UI surfaces them in a dedicated card via listPasskeys, so we filter
// them out here to avoid double-counting.
export const listMfaFactors = async (): Promise<MfaFactorView[]> => {
  const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionToken) return [];

  try {
    const resp = await getPactAuthClient().listMfaFactors({ sessionToken });

    return resp.factors
      .filter((f) => f.type.toLowerCase() === 'totp')
      .map((f) => ({
        factorId: f.factorId,
        type: f.type,
        label: f.label,
        verified: f.verified,
        createdAt: new Date(Number(f.createdAtUnix) * 1000),
      }));
  } catch {
    return [];
  }
};

export type PasskeyView = {
  passkeyId: string;
  label: string;
  createdAt: Date;
  lastUsedAt: Date | null;
};

export const listPasskeys = async (): Promise<PasskeyView[]> => {
  const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionToken) return [];

  try {
    const resp = await getPactAuthClient().listPasskeys({ sessionToken });

    return resp.passkeys.map((p) => ({
      passkeyId: p.passkeyId,
      label: p.label,
      createdAt: new Date(Number(p.createdAtUnix) * 1000),
      // last_used_at_unix == 0 ⇒ "never used since registration".
      lastUsedAt:
        Number(p.lastUsedAtUnix) > 0
          ? new Date(Number(p.lastUsedAtUnix) * 1000)
          : null,
    }));
  } catch {
    return [];
  }
};

// hasWebAuthnFactor powers the registration banner / dashboard nudge.
// We treat "any non-revoked passkey" as the signal — if the user has at
// least one passkey, they have a phishing-resistant primary factor and
// the banner shouldn't pester them.
export const hasWebAuthnFactor = async (): Promise<boolean> => {
  const passkeys = await listPasskeys();
  if (passkeys.length > 0) return true;

  // Fallback: also check the raw factors table for any "webauthn" type
  // factor we might have missed (e.g. WebAuthn-as-MFA enrollments). This
  // makes the banner stop nudging users who set up a security key as a
  // second factor without going through the passkey flow.
  const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionToken) return false;
  try {
    const resp = await getPactAuthClient().listMfaFactors({ sessionToken });

    return resp.factors.some(
      (f) =>
        f.verified &&
        (f.type.toLowerCase() === 'webauthn' ||
          f.type.toLowerCase() === 'passkey')
    );
  } catch {
    return false;
  }
};

export type OAuthIdentityView = {
  provider: string;
  providerUid: string;
  connectedAt: Date;
};

export const listIdentities = async (): Promise<OAuthIdentityView[]> => {
  const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionToken) return [];

  try {
    const resp = await getPactAuthClient().listIdentities({ sessionToken });

    return resp.identities.map((i) => ({
      provider: i.provider,
      providerUid: i.providerUid,
      connectedAt: new Date(Number(i.connectedAtUnix) * 1000),
    }));
  } catch {
    return [];
  }
};
