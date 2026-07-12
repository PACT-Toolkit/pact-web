'use client';

import { Button } from '@/src/components/ui/button';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

const ErrorPage = ({ error, reset }: Props) => (
  // Plain div, not <main> - SidebarInset (app/(app)/layout.tsx) already
  // renders the <main> landmark; this component fills its `children` slot.
  <div className="flex flex-1 items-center justify-center p-8">
    <div className="flex flex-col items-center gap-4 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      {error.digest && (
        <p className="font-mono text-sm text-muted-foreground">
          {error.digest}
        </p>
      )}
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  </div>
);

export default ErrorPage;
