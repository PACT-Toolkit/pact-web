'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import { SplashScreen } from './splash_screen';

// Query-param flag set by `app/page.tsx` when redirecting a logged-out
// visitor from `/` to `/login`. This component is the only thing that
// reads it: presence → mount the splash on top of whatever page is
// already rendered; absence → render nothing. The splash strips the
// flag from the URL via `router.replace` on close, so it's a one-shot
// gate.
const INTRO_PARAM = 'intro';
const INTRO_VALUE = '1';
const PAGE_ROOT_ID = 'page-content';

// While the splash is visible, the destination route is still in the
// DOM behind it. Without this guard, keyboard users can Tab into the
// login form and screen-reader users can read+activate it through the
// overlay. `inert` removes the subtree from focus/click and the
// accessibility tree atomically; `aria-hidden` is a belt-and-braces
// fallback for older a11y stacks that don't honour `inert` yet.
const useInertWhileMounted = () => {
  useEffect(() => {
    const pageRoot = document.getElementById(PAGE_ROOT_ID);
    if (!pageRoot) return;
    pageRoot.inert = true;
    pageRoot.setAttribute('aria-hidden', 'true');

    return () => {
      pageRoot.inert = false;
      pageRoot.removeAttribute('aria-hidden');
    };
  }, []);
};

const SplashOverlayActive = ({ onClose }: { onClose: () => void }) => {
  useInertWhileMounted();

  return <SplashScreen onClose={onClose} />;
};

const SplashOverlayInner = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const introPresent = searchParams.get(INTRO_PARAM) === INTRO_VALUE;
  if (!introPresent) return null;

  // The close animation runs entirely inside `SplashScreen` (it
  // schedules `onClose` via a setTimeout sized to `SPLIT_TOTAL_MS`),
  // so by the time we get here the halves are already off-screen and
  // the splash root is transparent. We just strip `?intro=1` — the
  // resulting re-render flips `introPresent` to false and the splash
  // unmounts cleanly. The destination route was visible behind the
  // splash for the entire close, so the unmount doesn't reveal
  // anything new to the user.
  const handleClose = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete(INTRO_PARAM);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return <SplashOverlayActive onClose={handleClose} />;
};

// Layout-level overlay that mounts the splash on top of whatever route
// is rendered. The gating logic lives in `SplashOverlayInner`; this
// wrapper provides the Suspense boundary that `useSearchParams`
// requires under Next 14+ app-router (without one, the entire layout
// would be force-deopted to client rendering).
export const SplashOverlay = () => (
  <Suspense fallback={null}>
    <SplashOverlayInner />
  </Suspense>
);
