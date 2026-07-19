import { type ReactNode } from 'react';
import { SWRConfig } from 'swr';

// Fresh SWR cache per mount so one test's cached entries never bleed into
// the next, with deduping off so every render hits MSW. Pass as
// renderHook's / render's `wrapper`, or wrap the rendered tree directly.
export const SWRTestProvider = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
);
