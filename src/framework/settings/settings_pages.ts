import {
  AlertTriangle,
  Bell,
  KeyRound,
  type LucideIcon,
  ScrollText,
  UserRound,
} from 'lucide-react';

export type SettingsPage = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

// The single list of settings pages. The in-page settings nav and the app
// sidebar both derive from it, so a new page is added in exactly one place.
export const SETTINGS_PAGES: readonly SettingsPage[] = [
  {
    href: '/settings/account',
    label: 'Profile',
    description: 'Display name, avatar, locale, timezone, bio.',
    icon: UserRound,
  },
  {
    href: '/settings/account/preferences',
    label: 'Notifications',
    description: 'Marketing and product emails.',
    icon: Bell,
  },
  {
    href: '/settings/account/consents',
    label: 'Consents',
    description: 'Documents you have agreed to and when.',
    icon: ScrollText,
  },
  {
    href: '/settings/security',
    label: 'Sign-in methods',
    description: 'Two-factor authentication, passkeys, recovery codes.',
    icon: KeyRound,
  },
  {
    href: '/settings/account/danger',
    label: 'Danger zone',
    description: 'Export your data or request account erasure.',
    icon: AlertTriangle,
  },
];

// Longest matching href wins, so /settings/account stays Profile only for
// its own route and never swallows /settings/account/consents.
export const findActiveSettingsPage = (
  pathname: string
): SettingsPage | undefined =>
  [...SETTINGS_PAGES]
    .sort((a, b) => b.href.length - a.href.length)
    .find(
      (page) => pathname === page.href || pathname.startsWith(`${page.href}/`)
    );
