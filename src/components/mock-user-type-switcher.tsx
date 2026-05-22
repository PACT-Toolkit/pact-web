'use client';

import { ChevronDown, FlaskConical } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/src/components/ui/sidebar';
import { isMock } from '@/src/framework/helpers/environment';
import {
  getMockUserType,
  MOCK_USER_TYPES,
  setMockUserType,
  type MockUserType,
} from '@/src/framework/helpers/mock_user_type';

// No external subscription needed — we only re-read on full page reload.
const noopSubscribe = () => () => {};
const getServerSnapshot = (): MockUserType => 'admin';

// Dev-only sidebar control that flips the active mock user type and
// reloads so the cookie change propagates to Server Components and
// MSW handlers on the next render. Hidden entirely in non-mock builds
// because the cookie has no meaning there.
export const MockUserTypeSwitcher = () => {
  const current = useSyncExternalStore(noopSubscribe, getMockUserType, getServerSnapshot);

  if (!isMock()) return null;

  const onSelect = (type: MockUserType) => {
    if (type === current) return;
    setMockUserType(type);
    window.location.reload();
  };

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton className="text-sidebar-foreground/70">
                <FlaskConical className="text-sidebar-foreground/70" />
                <span>
                  Mock user: <span className="font-medium text-sidebar-foreground">{current}</span>
                </span>
                <ChevronDown className="ml-auto h-3 w-3 text-sidebar-foreground/50" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-44">
              <DropdownMenuLabel>Mock user type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {MOCK_USER_TYPES.map(t => (
                <DropdownMenuCheckboxItem
                  key={t}
                  checked={t === current}
                  onCheckedChange={() => onSelect(t)}
                >
                  {t}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
};
