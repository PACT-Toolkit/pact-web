import { redirect } from 'next/navigation';

import { validateSessionFromCookies } from '@/src/framework/auth/pact_auth/session';
import { isSplashEnabled } from '@/src/framework/motion/splash_enabled';

// Entry point. The entry splash is opt-in per deployment
// (`PACT_WEB_SPLASH=enabled`, see `splash_enabled.ts`); it is off by
// default, and `/` then redirects straight to `/dashboard` or `/login`.
//
// When the splash is on, both logged-in and logged-out visitors get it
// when entering via `/` - logged-in users land on `/dashboard?intro=1`
// and logged-out users on `/login?intro=1`. The `?intro=1` flag is
// what `<SplashOverlay />` (mounted in `app/layout.tsx`) keys on to
// render the splash on top of whichever destination page resolved.
// The splash itself strips the flag from the URL when it closes.
//
// Because the splash lives at the layout level (above the routing
// layer), the destination page is fully rendered *behind* the splash
// for the entire entry sequence; when the user clicks Continue and the
// splash halves split apart, the real destination UI is what's
// revealed through the gap - not a blank backdrop waiting for a
// `router.replace` to fire.
//
// Direct visits to `/login`, `/dashboard`, etc. (no `?intro=1`) skip
// the splash; it's a deliberate first-impression moment for the `/`
// entry path, not something to interrupt every navigation with.
const HomePage = async () => {
  const session = await validateSessionFromCookies();
  const intro = isSplashEnabled() ? '?intro=1' : '';
  redirect(`${session ? '/dashboard' : '/login'}${intro}`);
};

export default HomePage;
