'use client';

import { AlertTriangle, Bell, ScrollText, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/src/lib/utils';

const ITEMS = [
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
    href: '/settings/account/danger',
    label: 'Danger zone',
    description: 'Export your data or request account erasure.',
    icon: AlertTriangle,
  },
];

export const AccountSettingsNav = () => {
  const pathname = usePathname();
  const sorted = [...ITEMS].sort((a, b) => b.href.length - a.href.length);
  const active =
    sorted.find(
      (item) => pathname === item.href || pathname.startsWith(item.href + '/')
    )?.href ?? ITEMS[0].href;

  return (
    <nav aria-label="Account settings" className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.href === active;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'group flex flex-col gap-0.5 rounded-md border border-transparent px-3 py-2 text-sm transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              isActive && 'border-border bg-accent text-accent-foreground'
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {item.description}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};
