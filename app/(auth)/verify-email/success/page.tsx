import { CircleCheckBig } from 'lucide-react';
import Link from 'next/link';

import { safeNextPath } from '@/src/app/auth/ui/verify-email/safe_next_path';
import { VerifyEmailNotifier } from '@/src/app/auth/ui/verify-email/VerifyEmailNotifier';
import { Button } from '@/src/components/ui/button';
import { FieldDescription } from '@/src/components/ui/field';

type SearchParams = { next?: string | string[] };

// /verify-email/success
//
// Reached after /api/auth/verify-email exchanges a verification token
// for a session — the cookie has already been set by that handler, so
// this page is just a confirmation beat. Two flows land here:
//
//  - Same-browser, two tabs: user opened the link in a new tab next to
//    the still-open `/register` "Check your email" screen.
//    `VerifyEmailNotifier` posts on the auth BroadcastChannel; the
//    register tab self-navigates to /dashboard. The user can close
//    *this* tab.
//
//  - Single tab (or different device): nobody is listening to the
//    broadcast, so the visible "Continue here" button is the path
//    forward. The session cookie is already set, so clicking it goes
//    straight into the app.
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
          You&apos;re signed in. Return to the tab where you started. You can
          close this one, or continue here if you don&apos;t have it open.
        </FieldDescription>
        <Button asChild size="lg" className="w-full">
          <Link href={target} replace prefetch={false}>
            Continue here
          </Link>
        </Button>
      </div>
      <VerifyEmailNotifier />
    </div>
  );
};

export default VerifyEmailSuccessPage;
