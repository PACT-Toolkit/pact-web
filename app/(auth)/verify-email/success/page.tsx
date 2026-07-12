import { CircleCheckBig } from 'lucide-react';
import Link from 'next/link';

import { safeNextPath } from '@/src/app/auth/domain/safe_next_path';
import { AuthVerifyEmailNotifier } from '@/src/app/auth/ui/verify-email/AuthVerifyEmailNotifier';
import { Button } from '@/src/components/ui/button';
import { FieldDescription } from '@/src/components/ui/field';

type SearchParams = { next?: string | string[] };

const VerifyEmailSuccessPage = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) => {
  const { next } = await searchParams;
  const target = safeNextPath(next);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div
        role="status"
        aria-live="polite"
        className="flex w-full max-w-sm flex-col items-center gap-4 text-center"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-positive/10">
          <CircleCheckBig className="h-6 w-6 text-positive" aria-hidden />
        </div>
        <h1 className="text-xl font-bold">Email verified</h1>
        <FieldDescription>
          You&apos;re signed in. Taking you to your dashboard&hellip;
        </FieldDescription>
        <Button asChild size="lg" className="w-full">
          <Link href={target} replace prefetch={false}>
            Continue now
          </Link>
        </Button>
      </div>
      <AuthVerifyEmailNotifier next={target} />
    </div>
  );
};

export default VerifyEmailSuccessPage;
