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
          className="cursor-default py-0 hover:bg-transparent hover:text-sidebar-foreground"
        >
          <div>
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Shield className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">PACT</span>
              <span className="text-xs text-muted-foreground">
                Prompt-Attack Countermeasure Toolkit
              </span>
            </div>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
