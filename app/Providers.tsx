'use client';

import { type ReactNode } from 'react';

import { MSWProvider } from '@/src/framework/msw/msw_provider';
import { SWRProvider } from '@/src/framework/swr/swr_provider';
import { ThemeProvider } from '@/src/framework/theme';

export const Providers = ({ children }: { children: ReactNode }) => (
  <ThemeProvider
    attribute="class"
    defaultTheme="system"
    enableSystem
    disableTransitionOnChange
  >
    <MSWProvider />
    <SWRProvider>{children}</SWRProvider>
  </ThemeProvider>
);
