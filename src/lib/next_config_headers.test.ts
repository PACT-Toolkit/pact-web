import { describe, expect, it } from 'vitest';

import nextConfig from '../../next.config';

// Regression test for a real bug found while verifying PACT-697: the
// Permissions-Policy header denied publickey-credentials-get to every
// origin, including this app's own top-level pages - silently breaking
// navigator.credentials.get() for passkey login/registration AND the new
// MFA passkey step-up in every real browser (Chrome's resulting
// NotAllowedError is indistinguishable from "user cancelled" or "no
// passkey", so this went unnoticed by both the app and its users). Guards
// against a future "deny everything" edit reintroducing `=()` here.
describe('next.config headers()', () => {
  it('allows this app itself to call navigator.credentials.get()', async () => {
    const headerGroups = await nextConfig.headers?.();
    const rootGroup = headerGroups?.find((g) => g.source === '/:path*');
    const policy = rootGroup?.headers.find(
      (h) => h.key === 'Permissions-Policy'
    );

    expect(policy?.value).toContain('publickey-credentials-get=(self)');
    expect(policy?.value).not.toContain('publickey-credentials-get=()');
  });
});
