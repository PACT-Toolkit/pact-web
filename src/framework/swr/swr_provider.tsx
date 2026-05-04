'use client';

import { type ReactNode } from 'react';
import { SWRConfig } from 'swr';

const SWRProvider = ({ children }: { children: ReactNode }) => (
  <SWRConfig
    value={{
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
    }}
  >
    {children}
  </SWRConfig>
);

export { SWRProvider };
