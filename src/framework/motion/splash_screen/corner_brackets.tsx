'use client';

import { motion } from 'motion/react';
import { Fragment } from 'react';

import {
  CORNER_ANCHORS,
  CORNER_DELAY_S,
  CORNER_DURATION_S,
  CORNER_EASE,
} from './splash_screen.const';

type CornerBracketsProps = {
  prefersReducedMotion: boolean;
};

// Eight thin strokes — two per corner — drawn just outside the parent's
// content box so each L sits in the margin rather than overlapping text.
// The horizontal stroke scales along X and the vertical stroke along Y,
// each pinned at the corner via `transform-origin`, so the stroke
// visibly *grows out of* the corner point. All four corners share
// `CORNER_DELAY_S` so they appear in unison rather than sweeping around
// the box.
//
// Used by both the welcome copy and the Continue button — they take
// identical bracket frames, so this is the single source of truth.
// Caller is responsible for being `relative` (the brackets are
// `absolute` and depend on the parent for positioning).
export const CornerBrackets = ({ prefersReducedMotion }: CornerBracketsProps) =>
  CORNER_ANCHORS.map(({ position, origin }) => (
    <Fragment key={position}>
      <motion.span
        aria-hidden="true"
        initial={prefersReducedMotion ? { scaleX: 1 } : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{
          duration: CORNER_DURATION_S,
          delay: CORNER_DELAY_S,
          ease: CORNER_EASE,
        }}
        style={{ transformOrigin: origin }}
        className={`pointer-events-none absolute block h-[2px] w-6 bg-current md:w-8 ${position}`}
      />
      <motion.span
        aria-hidden="true"
        initial={prefersReducedMotion ? { scaleY: 1 } : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{
          duration: CORNER_DURATION_S,
          delay: CORNER_DELAY_S,
          ease: CORNER_EASE,
        }}
        style={{ transformOrigin: origin }}
        className={`pointer-events-none absolute block h-6 w-[2px] bg-current md:h-8 ${position}`}
      />
    </Fragment>
  ));
