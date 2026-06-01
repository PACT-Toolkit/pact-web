'use client';

import { motion } from 'motion/react';

import { CornerBrackets } from './corner_brackets';
import { ScrambleText } from './scramble_text';
import { CONTINUE_SLIDE_MS, CONTINUE_TEXT } from './splash_screen.const';

type ContinueButtonProps = {
  prefersReducedMotion: boolean;
  onClick: () => void;
};

// Continue CTA — at `md+` lives in the same row as the count + welcome copy
// so its vertical center is the row's vertical center (which is also the
// midpoint between "Welcome to PACT" and "Press continue …"), anchored to
// the right edge via `right-12`, mirroring the welcome's left anchoring on
// the opposite side. Below `md` the row is a column and the button drops
// below the welcome copy as a horizontally-centered flex item (the row's
// `items-center` does the centering — no `self-*` override), so the
// welcome and Continue stack on the same vertical centerline. `relative`
// is also kept on mobile so the corner brackets anchor to the button's
// own box rather than the row container. Slides in from the right
// (`x: 80 → 0`) to balance the welcome's slide-in from the left. Reuses
// the same corner bracket frame as the welcome copy so the two read as a
// single "ticketed" pair.
export const ContinueButton = ({
  prefersReducedMotion,
  onClick,
}: ContinueButtonProps) => (
  <motion.button
    key="continue"
    type="button"
    onClick={onClick}
    initial={prefersReducedMotion ? { x: 0 } : { x: 80 }}
    animate={{ x: 0 }}
    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    whileHover={prefersReducedMotion ? undefined : { scale: 1.03 }}
    whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
    className="relative cursor-pointer bg-current/0 px-12 py-5 font-grotesk text-2xl font-medium tracking-normal text-current backdrop-blur-xl transition-colors outline-none hover:bg-current/0.5 focus-visible:ring-2 focus-visible:ring-current/40 md:absolute md:top-1/2 md:right-12 md:-translate-y-1/2 md:px-16 md:py-7 md:text-3xl"
  >
    <ScrambleText
      text={CONTINUE_TEXT}
      revealStartMs={CONTINUE_SLIDE_MS}
      prefersReducedMotion={prefersReducedMotion}
    />
    <CornerBrackets prefersReducedMotion={prefersReducedMotion} />
  </motion.button>
);
