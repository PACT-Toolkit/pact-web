import Link from 'next/link';

import { Button } from '@/src/components/ui/button';
import { FieldDescription } from '@/src/components/ui/field';

const REASONS: Record<string, string> = {
  missing_token: 'The verification link is missing its token.',
  invalid_or_expired:
    'This verification link is invalid or has expired. Try registering again to get a new one.',
  server_error: 'Something went wrong on our end. Please try again later.',
};

type SearchParams = { reason?: string | string[] };

const VerifyEmailFailedPage = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) => {
  const { reason } = await searchParams;
  const key = Array.isArray(reason) ? reason[0] : reason;
  const message = (key && REASONS[key]) || REASONS.server_error;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <h1 className="text-xl font-bold">Verification failed</h1>
        <FieldDescription>{message}</FieldDescription>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/login">Back to sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Try again</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailFailedPage;
