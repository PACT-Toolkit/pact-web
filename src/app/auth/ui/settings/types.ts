// Data shapes the settings panel renders. Mirror the projections returned
// by `src/framework/auth/pact_auth/factors.ts`, intentionally narrowed to
// the fields the UI actually displays.

export type MfaFactor = {
  factorId: string;
  type: string;
  label: string;
  verified: boolean;
  createdAt: Date;
};

export type Passkey = {
  passkeyId: string;
  label: string;
  createdAt: Date;
  lastUsedAt: Date | null;
};

export type OAuthIdentitySummary = {
  provider: string;
  providerUid: string;
  connectedAt: Date;
};
