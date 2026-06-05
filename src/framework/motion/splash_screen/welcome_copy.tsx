'use client';

import { motion } from 'motion/react';

import { CornerBrackets } from './corner_brackets';
import { ScrambleText } from './scramble_text';
import {
  HEADING_REVEAL_START_MS,
  HEADING_TEXT,
  SUBTITLE_LINE_1,
  SUBTITLE_LINE_1_REVEAL_START_MS,
  SUBTITLE_LINE_2,
  SUBTITLE_LINE_2_REVEAL_START_MS,
} from './splash_screen.const';

type WelcomeCopyProps = {
  prefersReducedMotion: boolean;
};

// Welcome copy — at `md+` anchored to the screen's left edge and vertically
// centered to the row that also holds the (centered) count and the
// (right-anchored) Continue button. Below `md` the row is a column and
// the welcome flows as a normal flex item, picking up the row's
// `items-center` to sit horizontally centered above the (also-centered)
// Continue button. The wrapper is `relative` (overridden to
// `md:absolute` on desktop) so the corner brackets inside have a
// containing block to anchor to — without it they'd climb the DOM until
// they hit the row container and sit at the viewport's edges.
//
// Either way, two lines slide in from offstage left with a small
// stagger; the splash root's own `overflow-hidden` clips the offstage
// start so the row itself doesn't need to clip (which would crop the
// heading's descenders).
//
// `x: '-100%'` translates each line by its own full width to the left, so
// initially only the far-right edge (the END of the sentence) is poking
// into the viewport from offstage. As `x` animates to 0, the line slides
// rightward into rest, revealing earlier and earlier characters until the
// BEGINNING is finally in place.
//
// No `delay` on the slide transitions: the wrapper only mounts AFTER
// `numberGone` flips (i.e. after the number's slide-down has fully
// completed + a small buffer), so the slide should begin the instant the
// lines appear rather than sitting at `initial` for a delay window. The
// second line gets a tiny 0.1 s offset for cascade feel.
export const WelcomeCopy = ({ prefersReducedMotion }: WelcomeCopyProps) => (
  <motion.div
    key="welcome"
    initial={false}
    className="relative font-grotesk tracking-normal -mt-5 md:absolute md:top-1/2 md:left-12 md:-translate-y-1/2"
  >
    <motion.div
      initial={prefersReducedMotion ? { x: 0 } : { x: '-100%' }}
      animate={{ x: 0 }}
      transition={{
        duration: 1.1,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="text-4xl leading-tight font-semibold tracking-tight md:text-6xl"
    >
      <ScrambleText
        text={HEADING_TEXT}
        revealStartMs={HEADING_REVEAL_START_MS}
        prefersReducedMotion={prefersReducedMotion}
      />
    </motion.div>
    <motion.div
      initial={prefersReducedMotion ? { x: 0 } : { x: '-100%' }}
      animate={{ x: 0 }}
      transition={{
        duration: 1.1,
        ease: [0.16, 1, 0.3, 1],
        delay: 0.1,
      }}
      className="mt-2 text-3xl leading-tight text-black/60 md:text-5xl dark:text-white/60"
    >
      <ScrambleText
        text={SUBTITLE_LINE_1}
        revealStartMs={SUBTITLE_LINE_1_REVEAL_START_MS}
        prefersReducedMotion={prefersReducedMotion}
      />
      <br />
      <ScrambleText
        text={SUBTITLE_LINE_2}
        revealStartMs={SUBTITLE_LINE_2_REVEAL_START_MS}
        prefersReducedMotion={prefersReducedMotion}
      />
    </motion.div>

    <CornerBrackets prefersReducedMotion={prefersReducedMotion} />
  </motion.div>
);
