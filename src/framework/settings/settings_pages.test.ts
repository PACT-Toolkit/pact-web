import { describe, expect, it } from 'vitest';

import {
  findActiveSettingsPage,
  SETTINGS_PAGES,
} from '@/src/framework/settings/settings_pages';

describe('SETTINGS_PAGES', () => {
  it('lists the five settings pages in order', () => {
    expect(SETTINGS_PAGES.map((p) => [p.label, p.href])).toEqual([
      ['Profile', '/settings/account'],
      ['Notifications', '/settings/account/preferences'],
      ['Consents', '/settings/account/consents'],
      ['Sign-in methods', '/settings/security'],
      ['Danger zone', '/settings/account/danger'],
    ]);
  });
});

describe('findActiveSettingsPage', () => {
  it.each([
    ['/settings/account', 'Profile'],
    ['/settings/account/preferences', 'Notifications'],
    ['/settings/account/consents', 'Consents'],
    ['/settings/security', 'Sign-in methods'],
    ['/settings/security/', 'Sign-in methods'],
    ['/settings/account/danger', 'Danger zone'],
  ])('resolves %s to %s', (pathname, label) => {
    expect(findActiveSettingsPage(pathname)?.label).toBe(label);
  });

  it('returns undefined outside the settings pages', () => {
    expect(findActiveSettingsPage('/dashboard')).toBeUndefined();
  });
});
