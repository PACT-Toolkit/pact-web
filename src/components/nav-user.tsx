'use client';

import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/src/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/src/components/ui/sidebar';
import { Skeleton } from '@/src/components/ui/skeleton';
import { useSignOut } from '@/src/framework/auth/pact_auth/sign_out';

export type NavUserData = {
  displayName: string;
  secondary?: string;
  avatarUrl?: string;
  initials: string;
  loading?: boolean;
};

export const NavUser = ({ user }: { user: NavUserData }) => {
  const { isMobile } = useSidebar();
  const { signOut, pending } = useSignOut();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <NavUserAvatar user={user} />
              <NavUserText user={user} />
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <NavUserAvatar user={user} />
                <NavUserText user={user} />
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled>
                <Sparkles />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/settings/account">
                  <BadgeCheck />
                  Account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <CreditCard />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/account/preferences">
                  <Bell />
                  Notifications
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={pending}
              onSelect={(event) => {
                event.preventDefault();
                void signOut();
              }}
            >
              <LogOut />
              {pending ? 'Signing out…' : 'Log out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

const NavUserAvatar = ({ user }: { user: NavUserData }) => {
  if (user.loading) {
    return <Skeleton className="size-8 rounded-lg" />;
  }

  return (
    <Avatar className="h-8 w-8 rounded-lg">
      {user.avatarUrl && (
        <AvatarImage src={user.avatarUrl} alt={user.displayName} />
      )}
      <AvatarFallback className="rounded-lg">{user.initials}</AvatarFallback>
    </Avatar>
  );
};

const NavUserText = ({ user }: { user: NavUserData }) => {
  if (user.loading) {
    return (
      <div className="grid flex-1 gap-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    );
  }

  return (
    <div className="grid flex-1 text-left text-sm leading-tight">
      <span className="truncate font-medium">{user.displayName}</span>
      {user.secondary && (
        <span className="truncate text-xs text-muted-foreground">
          {user.secondary}
        </span>
      )}
    </div>
  );
};
