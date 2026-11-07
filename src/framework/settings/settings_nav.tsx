'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/src/lib/utils';

import { findActiveSettingsPage, SETTINGS_PAGES } from './settings_pages';

export const SettingsNav = () => {
  const pathname = usePathname() ?? '';
  const active = (findActiveSettingsPage(pathname) ?? SETTINGS_PAGES[0]).href;

  return (
    <nav aria-label="Settings" className="flex flex-col gap-1">
      {SETTINGS_PAGES.map((item) => {
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
