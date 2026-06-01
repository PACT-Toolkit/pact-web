'use client';

import { useMotionValue } from 'motion/react';

import { ContinueButton } from './continue_button';
import { EtherealBackdrop } from './ethereal_backdrop';
import { PactMarkStack } from './pact_mark_stack';
import { WelcomeCopy } from './welcome_copy';

// Frozen snapshot of the splash's final state — ethereal backdrop, mark
// fully revealed, welcome copy at rest, Continue button at rest, no
// count. Used by `SplitTransition` as the "what slides off-screen"
// content for the two clipped halves. The backdrop is part of the
// facade (rather than living at the splash root) so each half carries
// its own backdrop layer with it as it slides — without this, the
// backdrop would stay pinned to the viewport while only the splash
// content split, and the reveal would feel half-done.
//
// Implementation note: rather than maintaining a separate pixel-perfect
// static layout (which would drift the instant the live components are
// retuned), the facade re-renders the same `PactMarkStack` / `WelcomeCopy`
// / `ContinueButton` components with `prefersReducedMotion={true}`. Those
// components already treat reduced-motion as "render the final state with
// no entry animations", which is exactly what the facade needs. Frozen
// `progress = 100` and `breathCenter = 0` motion values give the mark its
// fully-filled mask with the breath fully eclipsed by the fill — same
// pixels the live splash shows at the moment Continue is clickable.
//
// The outer column layout MUST mirror the live splash root's spacing
// (`flex flex-col items-center justify-start gap-30 pt-[8vh]` + the
// `min-h-[1em] text-6xl/8xl` row) so that when the facade is clipped to
// the top or bottom half of the viewport, the visible pixels align
// exactly with the live splash content underneath. The row also needs
// the same responsive `flex-col → md:flex-row` switch so the stacked
// mobile layout (count → welcome → Continue) lines up with the live
// splash on narrow viewports. Any drift here would be visible as a
// one-frame jump at the moment the facade halves mount.
//
// `relative isolate` on the outer div establishes a stacking context so
// the backdrop's `-z-10` is contained to the facade — without
// `isolation: isolate` the negative z-index would punch through to the
// splash root, layering the two facade backdrops *behind* the live
// splash bg and rendering them invisible.
export const SplashFacade = () => {
  const frozenProgress = useMotionValue(100);
  const frozenBreath = useMotionValue(0);

  return (
    <div className="pointer-events-none relative isolate flex min-h-svh w-full flex-col items-center justify-start gap-12 bg-white pt-[5vh] pb-[5vh] text-black md:gap-30 md:pt-[8vh] md:pb-0 dark:bg-black dark:text-white">
      <EtherealBackdrop />
      <PactMarkStack
        progress={frozenProgress}
        breathCenter={frozenBreath}
        prefersReducedMotion
      />
      <div className="relative flex w-full flex-1 flex-col items-center justify-center gap-16 text-6xl leading-none tabular-nums tracking-tight md:min-h-[1em] md:flex-none md:flex-row md:justify-start md:gap-0 md:text-8xl">
        <WelcomeCopy prefersReducedMotion />
        {/* `onClick` is a no-op — the facade is aria-hidden and its
            button is never interactive (pointer-events: none on the
            wrapper above). Click handling lives on the live Continue
            button rendered before the close starts. */}
        <ContinueButton prefersReducedMotion onClick={() => undefined} />
      </div>
    </div>
  );
};
