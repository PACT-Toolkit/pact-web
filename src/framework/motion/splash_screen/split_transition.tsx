'use client';

import { motion } from 'motion/react';

import { SplashFacade } from './splash_facade';
import {
  SPLIT_LINE_DRAW_EASE,
  SPLIT_LINE_DRAW_S,
  SPLIT_SLIDE_DELAY_S,
  SPLIT_SLIDE_EASE,
  SPLIT_SLIDE_S,
} from './splash_screen.const';

// Splash exit choreography: two horizontal strokes overlap at the
// viewport's vertical centre, scaling in from 0 to full width to form
// what the viewer reads as a single thin seam line. After a short beat
// the splash visual (rendered twice as a frozen facade — once clipped
// to the top half of the viewport, once to the bottom) starts sliding
// off-screen on its own axis (top half `y: -100%`, bottom half
// `y: 100%`). Each seam stroke is pinned inside its half wrapper —
// the top stroke at the wrapper's `bottom-1/2` (so it sits just above
// the clip cutoff), the bottom stroke at `top-1/2` (just below) — so
// they're carried offstage by the same translate that moves the
// halves. From the viewer's perspective the single seam line visibly
// splits into two and rides away with the splash.
//
// By the time the slide ends, the orchestrator's `setTimeout` (gated
// on SPLIT_TOTAL_MS) has fired `router.replace`, and the destination
// route mounts in place. Because the splash bg (`bg-white
// dark:bg-black`) matches the destination bg, the splash → destination
// unmount/mount swap is invisible.
//
// Reduced-motion users never see this — the orchestrator short-circuits
// `handleContinue` and calls `router.replace` immediately. This
// component is only mounted on the animated path.
//
// Why two facade copies rather than one with animated clip-path: CSS
// `clip-path` clips the visible region but doesn't translate it. To
// make the top half visibly *carry* the top of the splash off-screen,
// the content has to be a real translatable element. Each half
// therefore renders its own full `<SplashFacade />` and clips itself
// to its half with an inline `clip-path: inset(…)`; the wrapper's `y`
// transform then moves the clipped content (and the seam stroke
// pinned inside it) offstage as one piece.
export const SplitTransition = () => (
  <>
    {/* Top half — clipped to viewport top 50%, slides up. The wrapper
        is absolute/full-screen so its inner facade lays out at the
        same coordinates as the live splash content; clip-path then
        reveals only the top half, and `y` translates the whole
        wrapper (clip + seam stroke included) off-screen. */}
    <motion.div
      key="split-top"
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden"
      style={{ clipPath: 'inset(0 0 50% 0)' }}
      initial={{ y: 0 }}
      animate={{ y: '-100%' }}
      transition={{
        duration: SPLIT_SLIDE_S,
        ease: SPLIT_SLIDE_EASE,
        delay: SPLIT_SLIDE_DELAY_S,
      }}
    >
      <SplashFacade />
      {/* Top half's seam stroke. `bottom-1/2` pins the stroke's bottom
          edge at the wrapper's 50% line — i.e. 1 px above the clip
          cutoff, so it sits at the very bottom of the visible top
          half. `origin-center` makes scaleX expand the line outward
          from the screen's vertical centre line. */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-1/2 h-px origin-center bg-current"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{
          duration: SPLIT_LINE_DRAW_S,
          ease: SPLIT_LINE_DRAW_EASE,
        }}
      />
    </motion.div>

    {/* Bottom half — clipped to viewport bottom 50%, slides down. */}
    <motion.div
      key="split-bottom"
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden"
      style={{ clipPath: 'inset(50% 0 0 0)' }}
      initial={{ y: 0 }}
      animate={{ y: '100%' }}
      transition={{
        duration: SPLIT_SLIDE_S,
        ease: SPLIT_SLIDE_EASE,
        delay: SPLIT_SLIDE_DELAY_S,
      }}
    >
      <SplashFacade />
      {/* Bottom half's seam stroke. `top-1/2` pins the stroke's top
          edge at the wrapper's 50% line — 1 px below the clip cutoff,
          at the very top of the visible bottom half. Sits flush
          against the top stroke during phase 1 so the two read as a
          single seam line; once the halves start sliding apart this
          stroke rides downward while its sibling rides upward, and
          the seam visibly tears in two. */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px origin-center bg-current"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{
          duration: SPLIT_LINE_DRAW_S,
          ease: SPLIT_LINE_DRAW_EASE,
        }}
      />
    </motion.div>
  </>
);
