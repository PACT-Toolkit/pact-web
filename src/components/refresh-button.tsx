'use client';

import { RefreshCw } from 'lucide-react';

import { Button } from '@/src/components/ui/button';

type RefreshButtonProps = {
  onRefresh: () => void;
  // Disables the button and spins the icon while a fetch is in flight
  // (wire to SWR's isValidating).
  busy?: boolean;
  testId?: string;
};

// The outline "Refresh" button every live PACT panel places in its card
// header. Icon-only ghost refresh buttons (the files feature) are a
// different UX shape and intentionally not this component.
export const RefreshButton = ({
  onRefresh,
  busy = false,
  testId,
}: RefreshButtonProps) => (
  <Button
    variant="outline"
    size="sm"
    onClick={onRefresh}
    disabled={busy}
    data-testid={testId}
  >
    <RefreshCw
      className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`}
      aria-hidden
    />
    Refresh
  </Button>
);
