// Persona switching for `pnpm run dev:mock`. Lets a developer flip
// between mock identities without restarting the dev server, so the UI
// for each role can be exercised on the same running instance.
//
// Today PACT has only one functional role surface (single Ada Lovelace
// account), so this exists primarily as the cookie/helper plumbing that
// future role-gated features can read. Mirrors lunar/terra-web's
// `mock_user_type` helper.

export type MockUserType = 'admin' | 'auditor' | 'developer';

export const MOCK_USER_TYPES: readonly MockUserType[] = ['admin', 'auditor', 'developer'];

export const MOCK_USER_TYPE_COOKIE = 'mock-user-type';

const DEFAULT_MOCK_USER_TYPE: MockUserType = 'admin';

const isMockUserTypeValue = (v: unknown): v is MockUserType =>
  typeof v === 'string' && (MOCK_USER_TYPES as readonly string[]).includes(v);

// Reads the active mock user type from document.cookie. Returns the
// default when called server-side (no document) — server reads should
// come from next/headers cookies() and validate via isMockUserTypeValue.
export const getMockUserType = (defaultValue: MockUserType = DEFAULT_MOCK_USER_TYPE): MockUserType => {
  if (typeof document === 'undefined') return defaultValue;

  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${MOCK_USER_TYPE_COOKIE}=`));
  const raw = match?.slice(MOCK_USER_TYPE_COOKIE.length + 1);

  return isMockUserTypeValue(raw) ? raw : defaultValue;
};

// Persists a user type for the rest of the session. Caller is
// responsible for triggering a re-render / reload so dependent UI
// picks up the new value.
export const setMockUserType = (type: MockUserType): void => {
  if (typeof document === 'undefined') return;

  // path=/ so every route sees it; no expiry so it survives reloads
  // within the tab but doesn't outlive the browser session.
  document.cookie = `${MOCK_USER_TYPE_COOKIE}=${type}; path=/; SameSite=Lax`;
};

export const isMockUserType = (types: readonly MockUserType[]): boolean =>
  types.includes(getMockUserType());
