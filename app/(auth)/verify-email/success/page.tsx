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
// this page is purely a confirmation beat. Two flows land here:
//
//  - Same-browser, two tabs: user opened the link in a new tab next to
//    the still-open `/register` "Check your email" screen.
//    `VerifyEmailNotifier` posts on the auth BroadcastChannel; the
//    register tab self-navigates to /dashboard immediately. This tab
//    also auto-forwards to the dashboard after a short beat.
//
//  - Different device (e.g. laptop register, phone verify): no other
//    tab is listening to the broadcast, but this tab still auto-
//    forwards after the same short beat so the phone isn't left on a
//    confirmation screen with no obvious next action. The visible
//    button is the no-JS / "skip the wait" fallback.
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
      <VerifyEmailNotifier next={target} />
    </div>
  );
};

export default VerifyEmailSuccessPage;
