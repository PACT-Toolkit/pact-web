'use client';

import { type ReactNode } from 'react';

import { MSWProvider } from '@/src/framework/msw/msw_provider';
import { SWRProvider } from '@/src/framework/swr/swr_provider';

export const Providers = ({ children }: { children: ReactNode }) => (
  <>
    <MSWProvider />
    <SWRProvider>{children}</SWRProvider>
  </>
);
