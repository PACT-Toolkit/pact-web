'use client';

import { Fragment, useEffect, useRef, useState } from 'react';

import {
  REVEAL_STAGGER_MS,
  SCRAMBLE_INTERVAL_MS,
  SCRAMBLE_LOWER,
  SCRAMBLE_SYMBOL,
  SCRAMBLE_UPPER,
} from './splash_screen.const';

type ScrambleTextProps = {
  text: string;
  revealStartMs: number;
  prefersReducedMotion: boolean;
};

// Build a scrambled snapshot of `text`. Characters before `lockedCount`
// render as their final glyph; the rest are replaced with a random pick
// from the case-matching SCRAMBLE_* pool (uppercase → uppercase, etc.).
// Whitespace is preserved so word boundaries stay readable through the
// scramble. Math.random() lives here, NOT in the component's render
// body, so render stays pure / idempotent — the impure call only runs
// inside state setters and effect callbacks.
const buildScrambleSnapshot = (text: string, lockedCount: number): string =>
  text
    .split('')
    .map((c, i) => {
      if (i < lockedCount) return c;
      if (c === ' ' || c === '\n') return c;

      const pool =
        c >= 'A' && c <= 'Z'
          ? SCRAMBLE_UPPER
          : c >= 'a' && c <= 'z'
            ? SCRAMBLE_LOWER
            : SCRAMBLE_SYMBOL;

      return pool[Math.floor(Math.random() * pool.length)];
    })
    .join('');

export const ScrambleText = ({
  text,
  revealStartMs,
  prefersReducedMotion,
}: ScrambleTextProps) => {
  // Mirror of `lockedCount` in a ref so async interval callbacks can
  // read the current value synchronously without us having to call
  // setState from inside the effect body (which would cascade-render).
  // The ref is the source of truth that the intervals mutate; the
  // state is bumped in lockstep so the render tree knows when to swap
  // to the plain-text branch below.
  const initialLockedCount = prefersReducedMotion ? text.length : 0;
  const lockedCountRef = useRef(initialLockedCount);
  const [lockedCount, setLockedCount] = useState(initialLockedCount);

  // Snapshot of the currently rendered string. Initial value is the
  // real text so reduced-motion users render the final string
  // immediately and so the first off-screen paint of the animated path
  // doesn't show an empty span. The first scramble interval tick
  // (≤ SCRAMBLE_INTERVAL_MS after mount) replaces this with a random
  // snapshot — and by that point the parent slide is still well off-
  // screen, so the brief initial "real" snapshot isn't visible.
  const [display, setDisplay] = useState(text);

  // Scramble loop. setInterval ticks at SCRAMBLE_INTERVAL_MS and re-
  // rolls the random characters for every still-unlocked position. The
  // callback self-clears once everything is locked, so the timer
  // doesn't burn cycles after the reveal completes.
  useEffect(() => {
    if (prefersReducedMotion) return;
    const id = setInterval(() => {
      if (lockedCountRef.current >= text.length) {
        clearInterval(id);

        return;
      }
      setDisplay(buildScrambleSnapshot(text, lockedCountRef.current));
    }, SCRAMBLE_INTERVAL_MS);

    return () => clearInterval(id);
  }, [text, prefersReducedMotion]);

  // Reveal loop: after `revealStartMs`, advance lockedCount by 1 every
  // REVEAL_STAGGER_MS until the whole string is revealed. On each tick
  // we also bump `display` directly with the new lockedCount, so the
  // just-locked character renders as its real glyph this frame —
  // without this, the position would keep showing a random char until
  // the next scramble tick (up to SCRAMBLE_INTERVAL_MS later) and the
  // reveal would visibly stutter.
  useEffect(() => {
    if (prefersReducedMotion) return;
    let revealId: ReturnType<typeof setInterval> | undefined;
    const startId = setTimeout(() => {
      revealId = setInterval(() => {
        if (lockedCountRef.current >= text.length) {
          if (revealId) clearInterval(revealId);

          return;
        }
        lockedCountRef.current += 1;
        setLockedCount(lockedCountRef.current);
        setDisplay(buildScrambleSnapshot(text, lockedCountRef.current));
      }, REVEAL_STAGGER_MS);
    }, revealStartMs);

    return () => {
      clearTimeout(startId);
      if (revealId) clearInterval(revealId);
    };
  }, [revealStartMs, text, prefersReducedMotion]);

  // Fully revealed: drop the overlay scaffolding and render the plain
  // text so the DOM stays minimal for the rest of the splash's lifetime.
  if (lockedCount >= text.length) {
    return <>{text}</>;
  }

  // Split into [word, whitespace, word, …] segments and render each
  // word inside its own width-locked slot. The slot's width is locked
  // by an invisible copy of the *real* word underneath the scramble
  // overlay, so a wider/narrower random glyph can never push later
  // words sideways or collapse the visible word count. Whitespace
  // segments render as plain text since they're never scrambled. The
  // `overflow-hidden` on each slot caps the visible scramble at the
  // slot's right edge so any residual intra-word width variance can't
  // creep past the word boundary.
  const segments: { value: string; offset: number; isWord: boolean }[] = [];
  let cursor = 0;
  for (const seg of text.split(/(\s+)/)) {
    if (seg.length > 0) {
      segments.push({
        value: seg,
        offset: cursor,
        isWord: !/^\s+$/.test(seg),
      });
    }
    cursor += seg.length;
  }

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {segments.map(({ value, offset, isWord }, idx) => {
          if (!isWord) {
            return <Fragment key={idx}>{value}</Fragment>;
          }

          const slot = display.slice(offset, offset + value.length);

          return (
            <span
              key={idx}
              className="relative inline-block overflow-hidden align-bottom"
            >
              <span className="invisible">{value}</span>
              <span className="absolute inset-0">{slot}</span>
            </span>
          );
        })}
      </span>
    </>
  );
};
