// Per-session throttle for the splash screen. The splash plays whenever the
// user enters via `/` (the layout-level overlay keys on `?intro=1` set by
// `app/page.tsx`); without a throttle, every internal navigation back to
// `/` replays the 0→100 % intro, which makes the deliberate brand moment
// feel like a forced loading screen. We persist a tiny "shown" flag in
// sessionStorage on *acknowledged* exit (Continue clicked, not just "the
// splash mounted and the tab was closed"). sessionStorage scopes to the
// browser tab session — closing the tab/window clears the flag, so the
// next app-open gets a fresh first impression. No TTL math, no clock
// dependence, no decision about "how long is long enough".

import { SPLASH_SESSION_KEY } from './splash_screen.const';

// sessionStorage is a synchronous browser API and is missing under SSR /
// in some lockdown profiles (Safari private mode used to throw on writes,
// embedded webviews can disable it entirely). Both helpers below treat any
// access failure as "no record" / "no-op" — the worst case is the splash
// plays one extra time, which is strictly better than a hard crash on the
// entry path.
const readStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

// True if the splash has already been acknowledged this session. Called
// synchronously during the overlay's render — anything that throws here
// would short-circuit the entry page, so the try/catch is mandatory rather
// than defensive.
export const wasShownThisSession = (): boolean => {
  const storage = readStorage();
  if (!storage) return false;
  try {
    return storage.getItem(SPLASH_SESSION_KEY) !== null;
  } catch {
    return false;
  }
};

// Stamp the session as having seen the splash. Called by `SplashScreen` at
// the moment the user commits to leaving the splash (either Continue or
// the reduced-motion auto-dismiss) — *not* on mount, so closing the tab
// during the intro doesn't burn the throttle and the next session still
// gets the full first-impression.
export const markShown = (): void => {
  const storage = readStorage();
  if (!storage) return;
  try {
    storage.setItem(SPLASH_SESSION_KEY, '1');
  } catch {
    // Quota-exceeded / locked-down profile — we just won't throttle in
    // this session. The splash will play again on the next entry, which
    // matches the failure mode of `wasShownThisSession` above (both lean
    // toward "show the splash" rather than "suppress it").
  }
};
