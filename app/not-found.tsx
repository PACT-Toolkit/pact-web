import Link from 'next/link';

import { Button } from '@/src/components/ui/button';

const NotFoundPage = () => (
  <main className="flex min-h-screen items-center justify-center p-8">
    <div className="flex flex-col items-center gap-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found</p>
      <Button asChild variant="outline">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </div>
  </main>
);

export default NotFoundPage;
