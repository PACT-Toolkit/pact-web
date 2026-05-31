'use client';

import { motion } from 'motion/react';

import {
  NUMBER_EXIT_MS,
  SPLIT_TEXT_CHARS,
  SPLIT_TEXT_CHAR_DURATION_S,
  SPLIT_TEXT_DELAY_S,
  SPLIT_TEXT_STAGGER_S,
} from './splash_screen.const';

type CountDisplayProps = {
  count: number;
  // Flips once the split-text reveal of "0%" has finished playing. Before
  // it flips, we render the staggered motion glyphs; after, we render a
  // plain `{count}%` so subsequent ticks don't re-trigger the entry
  // animation. Reduced-motion users start with it already `true`.
  splitTextDone: boolean;
  prefersReducedMotion: boolean;
};

// The percent block — animated split-text intro, live count, then a slide-
// down exit. Designed to be wrapped by an `<AnimatePresence>` in the
// orchestrator with `{!ready && <CountDisplay … />}` so the exit fires
// when the count completes.
export const CountDisplay = ({
  count,
  splitTextDone,
  prefersReducedMotion,
}: CountDisplayProps) => (
  <motion.div
    key="number"
    exit={
      prefersReducedMotion
        ? { opacity: 0 }
        : {
            y: '110%',
            transition: {
              duration: NUMBER_EXIT_MS / 1000,
              ease: [0.7, 0, 0.84, 0],
            },
          }
    }
    className="flex font-grotesk"
  >
    {splitTextDone ? (
      <span>
        {count}
        <span aria-hidden="true">%</span>
      </span>
    ) : (
      <span aria-hidden="true" className="flex">
        {SPLIT_TEXT_CHARS.map((char, i) => (
          <motion.span
            key={i}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{
              duration: SPLIT_TEXT_CHAR_DURATION_S,
              ease: [0.16, 1, 0.3, 1],
              delay: SPLIT_TEXT_DELAY_S + i * SPLIT_TEXT_STAGGER_S,
            }}
            className="inline-block"
          >
            {char}
          </motion.span>
        ))}
      </span>
    )}
  </motion.div>
);
