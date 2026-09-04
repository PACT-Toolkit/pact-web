'use client';

import {
  BrainCircuit,
  Eraser,
  Files,
  FlaskConical,
  Gauge,
  KeyRound,
  LayoutDashboard,
  Radar,
  Scale,
  ScrollText,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import {
  type AccountProfileResponse,
  useGetAccountProfile,
} from '@/src/__codegen__/rest/account';
import { MockUserTypeSwitcher } from '@/src/components/mock-user-type-switcher';
import { NavSection, type NavSectionItem } from '@/src/components/nav-section';
import { NavUser } from '@/src/components/nav-user';
import { SidebarBrand } from '@/src/components/sidebar-brand';
import { buildNavUser } from '@/src/components/sidebar-helpers';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/src/components/ui/sidebar';

type NavSectionData = {
  label: string;
  items: NavSectionItem[];
};

const isRouteActive = (pathname: string, url: string) => {
  if (url === '/') {
    return pathname === '/';
  }

  return pathname === url || pathname.startsWith(`${url}/`);
};

const buildNavSections = (pathname: string): NavSectionData[] => [
  {
    label: 'Overview',
    items: [
      {
        title: 'Dashboard',
        url: '/dashboard',
        icon: LayoutDashboard,
        isActive: isRouteActive(pathname, '/dashboard'),
      },
      {
        title: 'Activity',
        url: '/audit',
        icon: ScrollText,
        isActive: isRouteActive(pathname, '/audit'),
      },
    ],
  },
  {
    label: 'Pipeline',
    items: [
      {
        title: 'Gateway',
        url: '/gateway',
        icon: Radar,
        isActive: isRouteActive(pathname, '/gateway'),
      },
      {
        title: 'Filter decisions',
        url: '/filter',
        icon: ShieldCheck,
        isActive: pathname === '/filter',
      },
      {
        title: 'Classifier',
        url: '/classifier',
        icon: BrainCircuit,
        isActive: isRouteActive(pathname, '/classifier'),
      },
      {
        title: 'Consensus',
        url: '/consensus',
        icon: Scale,
        isActive: isRouteActive(pathname, '/consensus'),
      },
      {
        title: 'Redactor',
        url: '/redactor',
        icon: Eraser,
        isActive: isRouteActive(pathname, '/redactor'),
      },
    ],
  },
  {
    label: 'Governance',
    items: [
      {
        title: 'Policy',
        url: '/policy',
        icon: KeyRound,
        isActive: isRouteActive(pathname, '/policy'),
      },
      {
        title: 'Files',
        url: '/files',
        icon: Files,
        isActive: isRouteActive(pathname, '/files'),
      },
    ],
  },
  {
    label: 'Evaluation',
    items: [
      {
        title: 'Test lab',
        url: '/test-lab',
        icon: FlaskConical,
        isActive: isRouteActive(pathname, '/test-lab'),
      },
      {
        title: 'Benchmark',
        url: '/benchmark',
        icon: Gauge,
        isActive: isRouteActive(pathname, '/benchmark'),
      },
    ],
  },
  {
    label: 'General',
    items: [
      {
        title: 'Settings',
        url: '/settings/account',
        icon: Settings2,
        isActive: isRouteActive(pathname, '/settings'),
        items: [
          { title: 'Profile', url: '/settings/account' },
          { title: 'Notifications', url: '/settings/account/preferences' },
          { title: 'Consents', url: '/settings/account/consents' },
          { title: 'Sign-in methods', url: '/settings/security' },
          { title: 'Danger zone', url: '/settings/account/danger' },
        ],
      },
    ],
  },
];

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  userId: string;
};

export const AppSidebar = ({ userId, ...props }: AppSidebarProps) => {
  const pathname = usePathname() ?? '';
  const query = useGetAccountProfile();
  const profile: AccountProfileResponse | undefined =
    query.data?.status === 200 ? query.data.data : undefined;
  const isLoading = query.isLoading;
  const navSections = React.useMemo(
    () => buildNavSections(pathname),
    [pathname]
  );

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarBrand />
      </SidebarHeader>
      <SidebarContent>
        {navSections.map((section) => (
          <NavSection
            key={section.label}
            label={section.label}
            items={section.items}
          />
        ))}
        <MockUserTypeSwitcher />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={buildNavUser(userId, profile, isLoading)} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
