'use client';

import { Shield } from 'lucide-react';

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/src/components/ui/sidebar';

export const SidebarBrand = () => {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          size="lg"
          className="cursor-default hover:bg-transparent hover:text-sidebar-foreground"
        >
          <div>
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Shield className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">PACT</span>
              <span className="truncate text-xs text-muted-foreground">
                Privacy and Compliance Toolkit
              </span>
            </div>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
