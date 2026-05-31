'use client';

import { motion, type MotionValue, useTransform } from 'motion/react';

import { PactMark } from '../pact_mark';

import {
  ARTWORK_BOTTOM_PCT,
  ARTWORK_TOP_PCT,
  BREATH_BAND_HALF_PCT,
  FILL_TRANSITION_START,
} from './splash_screen.const';

type PactMarkStackProps = {
  // 0 → 100 sweep driven by the orchestrator. Drives the fill cutoff +
  // breath alpha derivations below.
  progress: MotionValue<number>;
  // 0 → 100 diagonal loop. Drives the breath band's centre along the
  // 45° axis; animation start/stop is owned by the orchestrator.
  breathCenter: MotionValue<number>;
  prefersReducedMotion: boolean;
};

// Two stacked copies of the mark:
//   1. A low-opacity ghost that's always visible — keeps the silhouette
//      readable between breath sweeps, and gives reduced-motion users
//      something to look at if the breath is suppressed.
//   2. A full-opacity copy on top, masked by *two* unioned gradients
//      that share the same 45° axis: a soft breath band that loops
//      bottom-left → top-right, and a hard-edged fill that's flat for
//      most of the load and then advances along the same diagonal
//      during the last 30% of the count. The fill permanently reveals
//      the mark from the bottom-left corner outward, so the breath is
//      gradually eclipsed and the splash resolves into a solid logo by
//      the time the count hits 100.
//
// Slow enter: the entire mark stack (ghost + masked bright copy) fades
// from 0 → 1 on mount. Reduced-motion users get the final opacity
// immediately so nothing animates for them.
export const PactMarkStack = ({
  progress,
  breathCenter,
  prefersReducedMotion,
}: PactMarkStackProps) => {
  // Local 0-to-1 progress through the fill window. Stays at 0 below the
  // transition threshold and ramps to 1 as the count goes from
  // FILL_TRANSITION_START → 100. Drives both the fill cutoff and the
  // breath fade so the two are perfectly in step.
  const fillT = useTransform(progress, (value) => {
    if (value <= FILL_TRANSITION_START) return 0;

    return (value - FILL_TRANSITION_START) / (100 - FILL_TRANSITION_START);
  });

  // Leading edge of the fill, expressed as a position along the *same* 45°
  // axis as the breath (0 = bottom-left corner, 100 = top-right corner).
  // On a square box the artwork's bottom-left corner projects to ~16% along
  // this axis and its top-right corner to ~84%, so the same constants used
  // for the vertical case still bracket the visible artwork.
  const fillCutoff = useTransform(fillT, (t) => {
    const lowerEdge = 100 - ARTWORK_BOTTOM_PCT;
    const upperEdge = 100 - ARTWORK_TOP_PCT;

    return lowerEdge + t * (upperEdge - lowerEdge);
  });

  // Breath peak alpha. Holds at 1 below the transition threshold and fades
  // 1 → 0 across the fill window, so the diagonal stripe doesn't keep
  // cycling through the unfilled portion while the fill is rising — by the
  // time the count reaches 100 the breath is fully invisible and only the
  // fill remains.
  const breathAlpha = useTransform(fillT, (t) => Math.max(0, 1 - t));

  // Composite mask: diagonal breath band UNIONED with a diagonal fill that
  // grows along the same 45° axis. The default `mask-composite: add` stacks
  // the two gradients additively — pixels masked by *either* layer stay
  // visible. As the fill advances it permanently locks in more of the mark
  // (from the bottom-left corner outward) AND the breath fades to 0, so the
  // stripe doesn't linger behind the fill — at progress=100 the fill covers
  // the artwork and the breath has vanished.
  const breathMask = useTransform(
    [breathCenter, fillCutoff, breathAlpha],
    ([center, cutoff, alpha]: number[]) => {
      const half = BREATH_BAND_HALF_PCT;
      const breath = `linear-gradient(45deg, transparent ${center - half}%, rgba(0, 0, 0, ${alpha}) ${center}%, transparent ${center + half}%)`;
      const fill = `linear-gradient(45deg, black ${cutoff}%, transparent ${cutoff}%)`;

      return `${breath}, ${fill}`;
    }
  );

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 2.2, ease: 'easeOut', delay: 0.3 }}
      className="relative h-72 w-72 md:h-96 md:w-96 lg:h-[28rem] lg:w-[28rem]"
    >
      <PactMark className="absolute inset-0 h-full w-full opacity-20" />
      <motion.div
        style={{
          WebkitMaskImage: breathMask,
          maskImage: breathMask,
        }}
        className="absolute inset-0"
      >
        <PactMark className="h-full w-full" />
      </motion.div>
    </motion.div>
  );
};
