'use client';

import {
  AudioWaveform,
  BookOpen,
  Bot,
  Command,
  Eraser,
  Files,
  FlaskConical,
  Frame,
  Gauge,
  GalleryVerticalEnd,
  KeyRound,
  LayoutDashboard,
  Map,
  PieChart,
  Scale,
  ScrollText,
  Settings2,
  ShieldCheck,
  SquareTerminal,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import {
  type Profile,
  useGetAccountProfile,
} from '@/src/__codegen__/rest/account';
import { MockUserTypeSwitcher } from '@/src/components/mock-user-type-switcher';
import { NavMain, type NavMainItem } from '@/src/components/nav-main';
import { NavProjects } from '@/src/components/nav-projects';
import { NavUser } from '@/src/components/nav-user';
import { buildNavUser } from '@/src/components/sidebar-helpers';
import { TeamSwitcher } from '@/src/components/team-switcher';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/src/components/ui/sidebar';

const teams = [
  { name: 'Acme Inc', logo: GalleryVerticalEnd, plan: 'Enterprise' },
  { name: 'Acme Corp.', logo: AudioWaveform, plan: 'Startup' },
  { name: 'Evil Corp.', logo: Command, plan: 'Free' },
];

const projects = [
  { name: 'Design Engineering', url: '#', icon: Frame },
  { name: 'Sales & Marketing', url: '#', icon: PieChart },
  { name: 'Travel', url: '#', icon: Map },
];

const isRouteActive = (pathname: string, url: string) => {
  if (url === '/') {
    return pathname === '/';
  }

  return pathname === url || pathname.startsWith(`${url}/`);
};

const buildNavMain = (pathname: string): NavMainItem[] => [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
    isActive: isRouteActive(pathname, '/dashboard'),
  },
  {
    title: 'Files',
    url: '/files',
    icon: Files,
    isActive: isRouteActive(pathname, '/files'),
  },
  {
    title: 'Filter decisions',
    url: '/filter',
    icon: ShieldCheck,
    isActive: pathname === '/filter',
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
  {
    title: 'Test lab',
    url: '/test-lab',
    icon: FlaskConical,
    isActive: isRouteActive(pathname, '/test-lab'),
  },
  {
    title: 'Policy',
    url: '/policy',
    icon: KeyRound,
    isActive: isRouteActive(pathname, '/policy'),
  },
  {
    title: 'Benchmark',
    url: '/benchmark',
    icon: Gauge,
    isActive: isRouteActive(pathname, '/benchmark'),
  },
  {
    title: 'Activity',
    url: '/audit',
    icon: ScrollText,
    isActive: isRouteActive(pathname, '/audit'),
  },
  {
    title: 'Settings',
    url: '/settings/account',
    icon: Settings2,
    isActive: isRouteActive(pathname, '/settings'),
    items: [
      { title: 'Profile', url: '/settings/account' },
      { title: 'Preferences', url: '/settings/account/preferences' },
      { title: 'Consents', url: '/settings/account/consents' },
      { title: 'Sign-in methods', url: '/settings/security' },
      { title: 'Danger zone', url: '/settings/account/danger' },
    ],
  },
  {
    title: 'Playground',
    url: '#',
    icon: SquareTerminal,
    items: [
      { title: 'History', url: '#' },
      { title: 'Starred', url: '#' },
      { title: 'Settings', url: '#' },
    ],
  },
  {
    title: 'Models',
    url: '#',
    icon: Bot,
    items: [
      { title: 'Genesis', url: '#' },
      { title: 'Explorer', url: '#' },
      { title: 'Quantum', url: '#' },
    ],
  },
  {
    title: 'Documentation',
    url: '#',
    icon: BookOpen,
    items: [
      { title: 'Introduction', url: '#' },
      { title: 'Get Started', url: '#' },
      { title: 'Tutorials', url: '#' },
      { title: 'Changelog', url: '#' },
    ],
  },
];

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  userId: string;
};

export const AppSidebar = ({ userId, ...props }: AppSidebarProps) => {
  const pathname = usePathname() ?? '';
  const query = useGetAccountProfile();
  const profile =
    query.data?.status === 200 ? (query.data.data as Profile) : undefined;
  const isLoading = query.isLoading;
  const navMain = React.useMemo(() => buildNavMain(pathname), [pathname]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavProjects projects={projects} />
        <MockUserTypeSwitcher />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={buildNavUser(userId, profile, isLoading)} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
