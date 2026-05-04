'use client';

import { useEffect } from 'react';

export const MSWProvider = () => {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_API_MOCKING === 'enabled') {
      import('@/mocks').then(({ init }) => init());
    }
  }, []);

  return null;
};
