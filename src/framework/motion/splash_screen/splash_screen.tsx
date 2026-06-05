'use client';

import {
  AnimatePresence,
  animate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { useEffect, useState } from 'react';

import {
  isLocalDevelopment,
  isMock,
} from '@/src/framework/helpers/environment';
import { ThemeToggle } from '@/src/framework/theme';

import { ContinueButton } from './continue_button';
import { CountDisplay } from './count_display';
import { EtherealBackdrop } from './ethereal_backdrop';
import { PactMarkStack } from './pact_mark_stack';
import {
  BREATH_CYCLE_S,
  ENTRY_DURATION_MS,
  NUMBER_EXIT_MS,
  POST_NUMBER_BUFFER_MS,
  SAFETY_TIMEOUT_MS,
  SPLIT_TEXT_TOTAL_MS,
  SPLIT_TOTAL_MS,
  SWEEP_EASE,
  VISIBLE_DURATION_MS,
} from './splash_screen.const';
import { markShown } from './splash_throttle';
import { SplitTransition } from './split_transition';
import { WelcomeCopy } from './welcome_copy';

type SplashScreenProps = {
  // Fires once the split-screen exit has fully cleared the viewport (or
  // immediately for reduced-motion users). The destination route is
  // *already mounted underneath* the splash — this component lives in
  // an overlay above the routing layer (see `splash_overlay.tsx`), so
  // there's nothing for the splash itself to navigate to. The overlay's
  // `onClose` typically just strips the `?intro=1` flag from the URL
  // and unmounts the splash, leaving the destination page visible.
  onClose: () => void;
};

export const SplashScreen = ({ onClose }: SplashScreenProps) => {
  const prefersReducedMotion = useReducedMotion() ?? false;

  // Owned at this level so the choreography effect can drive them and the
  // presentational children can read them. PactMarkStack derives its own
  // fill/breath transforms from `progress` and `breathCenter`.
  const progress = useMotionValue(0);
  const rounded = useTransform(progress, (value) => Math.round(value));
  const breathCenter = useMotionValue(0);

  const [count, setCount] = useState(0);
  // Gate the hand-off behind a manual Continue button — no auto-redirect.
  const [ready, setReady] = useState(false);
  const [splitTextDone, setSplitTextDone] = useState(false);
  // Flips after `ready` AND the number's slide-down exit have both finished
  // playing. The welcome copy + Continue button are gated on this flag (not
  // on `ready`) so they don't even *mount* until the number is fully gone —
  // that way their `initial` state isn't visible on screen during the
  // number's exit, and their slide-in starts the instant they appear
  // rather than after a `transition.delay` they'd otherwise sit through
  // partially visible.
  const [numberGone, setNumberGone] = useState(false);
  // Flips when the user clicks Continue. Swaps the live splash content
  // (mark + row) for the split-screen exit transition — see
  // `split_transition.tsx`. router.replace is scheduled for the end of
  // the transition by `handleContinue` below.
  const [closing, setClosing] = useState(false);

  useMotionValueEvent(rounded, 'change', setCount);

  useEffect(() => {
    // Reduced-motion users skip the staggered reveal — they swap to the
    // live count on the next tick (0 ms timeout keeps the setState out
    // of the effect body so the cascading-render lint stays happy).
    const delay = prefersReducedMotion ? 0 : SPLIT_TEXT_TOTAL_MS;
    const id = setTimeout(() => setSplitTextDone(true), delay);

    return () => clearTimeout(id);
  }, [prefersReducedMotion]);

  useEffect(() => {
    // `ready` only ever flips false → true once during the splash's
    // lifetime, so there's no need to reset `numberGone` back to false
    // in this effect — `numberGone` starts false via useState's initial
    // value and only flips true here. (Avoiding a synchronous setState
    // in the effect body also keeps the cascading-render lint happy.)
    if (!ready) return;

    // Reduced-motion users get an opacity-only number exit with no
    // explicit duration (defaults to ~0.3 s), so we wait a similarly
    // short window for them. Animated users wait for the full slide-
    // down plus a small buffer so the welcome doesn't crowd the
    // number's tail.
    const exitMs = prefersReducedMotion
      ? 200
      : NUMBER_EXIT_MS + POST_NUMBER_BUFFER_MS;
    const id = setTimeout(() => setNumberGone(true), exitMs);

    return () => clearTimeout(id);
  }, [ready, prefersReducedMotion]);

  useEffect(() => {
    let cancelled = false;

    if (prefersReducedMotion) {
      // Skip the count + breath; jump straight to a solid, fully-revealed
      // logo and reveal Continue immediately. Snapping `progress` to 100
      // also drives `fillCutoff` to the top of the artwork, so the bright
      // copy is fully unmasked without us touching the breath. Routed
      // through animate().then so setReady runs in a callback, not the
      // effect body (avoids the cascading-render warning).
      animate(progress, 100, { duration: 0 }).then(() => {
        if (!cancelled) setReady(true);
      });

      return () => {
        cancelled = true;
      };
    }

    // Loading signals the count waits on before crediting itself as
    // ready. The destination route is already mounted *behind* the
    // splash by the time we get here (the overlay sits above the
    // routing layer — see `splash_overlay.tsx`), so we no longer
    // prefetch anything; the count is purely waiting for the user's
    // browser to finish unboxing fonts and the initial document.
    const documentLoaded =
      document.readyState === 'complete'
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            window.addEventListener('load', () => resolve(), { once: true });
          });

    const signals: Array<Promise<unknown>> = [
      document.fonts ? document.fonts.ready : Promise.resolve(),
      documentLoaded,
    ];

    // Visible count: one ease-out sweep from 0 → 100. Held as a controls
    // handle so we can stop it on unmount and so we can await its completion
    // alongside the readiness gate. Delayed by ENTRY_DURATION_MS so the
    // count stays at 0 while the logo + number entry animations play, and
    // visibly *starts* loading only once both are settled on screen.
    const sweep = animate(progress, 100, {
      duration: VISIBLE_DURATION_MS / 1000,
      ease: SWEEP_EASE,
      delay: ENTRY_DURATION_MS / 1000,
    });

    // Breath: looping diagonal sweep (bottom-left → top-right) that runs
    // alongside the count. EaseInOut gives each rise a soft inhale/exhale
    // feel; the jump back to 0 between cycles happens with the band off the
    // bottom-left corner, so it reads as a clean restart rather than a cut.
    // Same entry delay as the sweep so "the logo breathes because the count
    // is climbing" stays true — no breath while the count is still parked
    // at zero waiting for the entry to finish.
    const breath = animate(breathCenter, 100, {
      duration: BREATH_CYCLE_S,
      ease: 'easeInOut',
      repeat: Infinity,
      repeatType: 'loop',
      delay: ENTRY_DURATION_MS / 1000,
    });

    // Readiness gate: whichever fires first wins. Real signals are preferred
    // (so on a slow connection we wait for them), capped by the safety so a
    // stuck signal can never extend total time past VISIBLE_DURATION_MS.
    const safetyFired = new Promise<void>((resolve) => {
      setTimeout(resolve, SAFETY_TIMEOUT_MS);
    });
    const signalsReady = Promise.race([
      Promise.all(signals).then(() => undefined),
      safetyFired,
    ]);

    void Promise.all([sweep, signalsReady]).then(() => {
      if (cancelled) return;
      // The fill has already engulfed the artwork by the time we land here
      // (progress is 100, fillCutoff is at the top of the artwork), so the
      // breath is fully eclipsed — we just stop the loop to free the frame
      // budget and reveal Continue.
      breath.stop();
      setReady(true);
    });

    return () => {
      cancelled = true;
      sweep.stop();
      breath.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = () => {
    // Stamp the throttle on *acknowledged* exit (the user clicked
    // Continue or reduced-motion auto-dismissed). Mounting alone doesn't
    // count — closing the tab during the intro should leave the next
    // entry fresh, see `splash_throttle.ts`.
    markShown();

    if (prefersReducedMotion) {
      // No animation, just hand control back to the overlay so it can
      // strip the `?intro=1` flag and unmount the splash. The
      // destination route is already on screen underneath.
      onClose();

      return;
    }

    // Kick the split-screen exit; call onClose at the instant the
    // halves have fully cleared the viewport. The destination route is
    // already rendered behind the splash, so as the halves slide apart
    // the real login page is what the viewer sees through the gap.
    setClosing(true);
    setTimeout(onClose, SPLIT_TOTAL_MS);
  };

  // Dev-only escape hatch: a tiny theme toggle so we can sanity-check the
  // splash in both light and dark without restarting the browser. Gated to
  // mock/local-dev so it can never ship to preview or production.
  const showDevThemeToggle = isMock() || isLocalDevelopment();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to PACT"
      aria-busy={!ready}
      className={`fixed inset-0 z-50 flex min-h-svh flex-col items-center justify-start gap-12 overflow-hidden pt-[5vh] pb-[5vh] text-black dark:text-white md:gap-30 md:pt-[8vh] md:pb-0 ${
        // During entry the root paints opaque so the destination page
        // underneath is hidden. The instant `closing` flips, the root
        // goes transparent — the facade halves still paint their own
        // bg so the splash looks unchanged at t=0, but as the halves
        // slide apart the now-transparent root exposes the live
        // destination route mounted behind the overlay.
        closing ? '' : 'bg-white dark:bg-black'
      }`}
    >
      {/* Live backdrop is only rendered before the close starts. Once
          `closing` flips, each facade half mounts its own backdrop
          inside its clipped region so the backdrop slides with the
          splash content. If we kept the live backdrop here it would
          stay pinned to the viewport behind the sliding halves and
          double up with the per-half copies. */}
      {!closing && <EtherealBackdrop />}

      {showDevThemeToggle && !closing && (
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
      )}

      {closing ? (
        // Exit choreography — frozen facade (backdrop + mark + welcome +
        // Continue) rendered twice, clipped to top + bottom halves, seam
        // line draws across the centre and the halves slide off-screen.
        // `handleContinue` already scheduled `router.replace` for the
        // end of the slide.
        <SplitTransition />
      ) : (
        <>
          <PactMarkStack
            progress={progress}
            breathCenter={breathCenter}
            prefersReducedMotion={prefersReducedMotion}
          />

          {/* Number row + bottom-left welcome + bottom-right Continue
              share this slot so they sit on the same horizontal Y line
              at `md+`. Below `md` there isn't enough width for the
              left/right anchored children not to collide, so the row
              flips to a column and the children stack vertically
              (count → welcome → Continue).
              - At `md+`: `flex items-center min-h-[1em]` — single
                horizontal row. The centered number, left-anchored
                welcome, and right-anchored Continue co-exist on the
                same line; `min-h-[1em]` (resolved against the
                wrapper's `text-8xl` font-size) keeps the row tall
                enough that the number's slide-down clip works and
                the slot doesn't collapse after exit.
              - On mobile: `flex-col flex-1 justify-center gap-16`
                — the row grows to fill the space below the mark
                and vertically centers its children, so the welcome
                + Continue stack reads as anchored to the middle of
                the lower viewport rather than crammed up against
                the mark's mobile `gap-12`. The `gap-16` (64 px) is
                sized to clear both the welcome's bottom corner
                brackets and Continue's top corner brackets (each
                extends ~20 px outside its box, so ~24 px of clean
                air remains between the two sets). Picked tight
                enough that even short portrait viewports
                (iPhone SE class, ~667 svh) fit the full stack
                without the bottom brackets clipping against the
                splash root's `pb-[5vh]` safe inset. While only
                the count is mounted (during the 0→100 sweep) the
                count itself is vertically centered the same way.
              - The number child uses `mx-auto` (inside its own clip
                wrapper) to land in the row's center in either layout
                — auto cross-axis margins center it horizontally in
                the column too.
              - In the desktop row, welcome + Continue are `absolute`
                with `top-1/2 -translate-y-1/2`, anchored to the
                screen's left/right edges and vertically centered to
                the row. In the mobile column they fall back to
                in-flow flex items, picking up the row's
                `items-center` so the two stack on a single
                vertical centerline. Each keeps `relative` on mobile
                so the corner brackets they contain anchor to their
                own box rather than escaping up the DOM to the row
                container.
              - `overflow-hidden` on the inner number wrapper is what
                clips the number's `y: 110%` slide-down exit. */}
          <div className="relative flex w-full flex-1 flex-col items-center justify-center gap-16 text-6xl leading-none tabular-nums tracking-tight md:min-h-[1em] md:flex-none md:flex-row md:justify-start md:gap-0 md:text-8xl">
            {/* Number clip wrapper. Overflow-hidden lives here (not on
                the row) so the number's slide-down exit is masked at the
                baseline without also clipping the welcome copy's
                descenders below the row's `min-h-[1em]` line. */}
            <div className="mx-auto -mt-5 flex overflow-hidden">
              <AnimatePresence>
                {!ready && (
                  <CountDisplay
                    count={count}
                    splitTextDone={splitTextDone}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {numberGone && (
                <WelcomeCopy prefersReducedMotion={prefersReducedMotion} />
              )}
            </AnimatePresence>

            <AnimatePresence>
              {numberGone && (
                <ContinueButton
                  prefersReducedMotion={prefersReducedMotion}
                  onClick={handleContinue}
                />
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* The splash root is `role="dialog"`, so it does NOT advertise
          its children as a live region (otherwise the 0→100 count
          would emit ~100 polite announcements). This sr-only span is
          the sole live region — screen readers get a single
          "Loading PACT" → "PACT is ready" transition. */}
      <span role="status" aria-live="polite" className="sr-only">
        {ready ? 'PACT is ready' : 'Loading PACT'}
      </span>
    </div>
  );
};
