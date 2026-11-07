import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsNav } from '@/src/framework/settings/settings_nav';

const pathnameMock = vi.hoisted(() => vi.fn<() => string>());

vi.mock('next/navigation', () => ({
  usePathname: pathnameMock,
}));

describe('SettingsNav', () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue('/settings/account');
  });

  it('renders all five entries in order', () => {
    render(<SettingsNav />);

    expect(
      screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    ).toEqual([
      '/settings/account',
      '/settings/account/preferences',
      '/settings/account/consents',
      '/settings/security',
      '/settings/account/danger',
    ]);
  });

  it('marks only Profile active on /settings/account', () => {
    render(<SettingsNav />);

    const current = screen.getAllByRole('link', { current: 'page' });
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Profile');
  });

  it('marks Sign-in methods active on /settings/security', () => {
    pathnameMock.mockReturnValue('/settings/security');
    render(<SettingsNav />);

    const current = screen.getAllByRole('link', { current: 'page' });
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Sign-in methods');
  });
});
