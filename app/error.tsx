'use client';

import { Button } from '@/src/components/ui/button';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

const ErrorPage = ({ error, reset }: Props) => (
  <main className="flex min-h-screen items-center justify-center p-8">
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
  </main>
);

export default ErrorPage;
