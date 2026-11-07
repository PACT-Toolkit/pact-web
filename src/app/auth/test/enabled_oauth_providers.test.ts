import { describe, expect, it, vi } from 'vitest';

import { parseEnabledOAuthProviders } from '@/src/app/auth/domain/enabled_oauth_providers';

vi.mock('server-only', () => ({}));

const ids = (raw: string | undefined) =>
  parseEnabledOAuthProviders(raw).map((p) => p.id);

describe('parseEnabledOAuthProviders', () => {
  it.each([
    ['unset', undefined, ['github', 'meta', 'google']],
    ['empty', '', ['github', 'meta', 'google']],
    ['blank', '   ', ['github', 'meta', 'google']],
    ['none', 'none', []],
    ['none, any case and padding', '  NoNe ', []],
    ['one id', 'github', ['github']],
    ['subset keeps canonical order', 'google,github', ['github', 'google']],
    ['padding and case', ' Google , GITHUB ', ['github', 'google']],
    ['unknown ids ignored', 'github,okta,', ['github']],
    ['only unknown ids', 'okta', []],
    ['duplicates collapse', 'meta,meta', ['meta']],
  ])('%s', (_label, raw, expected) => {
    expect(ids(raw)).toEqual(expected);
  });
});
