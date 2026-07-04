'use client';

import { useEffect } from 'react';

import { isMock } from '@/src/framework/helpers/environment';
import { installFetchGate } from '@/src/framework/msw/msw_fetch_gate';

// PACT-455: installed at module scope (not inside the effect below) so the
// gate is armed while this client chunk is first evaluated, before
// hydration commits and before any component's effects - including the
// init() call below - can fire a request. See msw_fetch_gate.ts for why a
// synchronous, early install point matters here.
installFetchGate();

export const MSWProvider = () => {
  useEffect(() => {
    if (isMock()) {
      import('@/mocks').then(({ init }) => init());
    }
  }, []);

  return null;
};
