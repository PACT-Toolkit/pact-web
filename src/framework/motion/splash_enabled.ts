import 'server-only';

// The entry splash is opt-in per deployment: only the exact value
// `enabled` (trimmed, case-insensitive) of PACT_WEB_SPLASH turns it on.
// Unset, empty, or any other value leaves it off.
export const parseSplashEnabled = (raw: string | undefined): boolean =>
  raw?.trim().toLowerCase() === 'enabled';

export const isSplashEnabled = (): boolean =>
  parseSplashEnabled(process.env.PACT_WEB_SPLASH);
