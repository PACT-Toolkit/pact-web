// All the splash's tunable timings, copy, and easing curves live here so the
// choreography can be re-tuned without touching any of the presentational
// components. Pure values — no React, no DOM. Comments explain the WHY of
// each number; the WHAT is self-evident from the constant name.

// ── Top-level pacing ────────────────────────────────────────────────────

// How long the on-mount entry choreography takes. The logo's fade is 2.2 s
// (longest of the entry animations — the percent block finishes at
// 0.35 + 1.6 = 1.95 s), so we hold the count + breath at their starting
// values until this point so the loading sweep visibly begins only once
// both the mark and the number are settled on screen.
export const ENTRY_DURATION_MS = 2200;

// The visible count is a single sweep from 0 → 100 over this duration. A
// gentle ease-out (see SWEEP_EASE) gives it a "little faster at the start,
// slowly slower toward the end" feel without the dramatic burst-then-crawl
// we used to get from layered per-signal animations. Real load signals are
// still awaited — they gate the Continue button — but they no longer nudge
// the count.
export const VISIBLE_DURATION_MS = 7800;

// Subtle easeOut cubic-bezier (≈ easeOutQuad). Less aggressive than motion's
// named 'easeOut' so the curve is felt rather than seen.
export const SWEEP_EASE: [number, number, number, number] = [
  0.25, 0.46, 0.45, 0.94,
];

// Hard ceiling on signal waiting. If a real signal stalls past this we treat
// the app as ready anyway so a stuck font / blocked `load` event can't trap
// the user on the splash. Matched to ENTRY + VISIBLE_DURATION so the worst-
// case total is the intended choreography length, not that length plus a
// signal stall.
export const SAFETY_TIMEOUT_MS = ENTRY_DURATION_MS + VISIBLE_DURATION_MS;

// ── Mark breath + fill ──────────────────────────────────────────────────

// While loading, a soft gradient band sweeps diagonally (bottom-left → top-
// right) across a bright copy of the mark on a continuous loop, giving the
// illusion of the logo breathing. The cycle runs independently of the count
// so the pace stays calm even when the count is climbing quickly.
export const BREATH_CYCLE_S = 2.2;

// Half-height of the breath band along the diagonal axis (in %). Larger =
// softer, wider glow; smaller = a tighter scanning line.
export const BREATH_BAND_HALF_PCT = 30;

// The mark SVG (1254×1254 viewBox) has ~16% transparent padding on top and
// bottom — the artwork sits between roughly y=200 and y=1057. The fill mask
// is sized to this band so progress=100 fills exactly the visible artwork.
export const ARTWORK_TOP_PCT = 16;
export const ARTWORK_BOTTOM_PCT = 84;

// Once the count crosses this threshold, the diagonal breath starts
// dissolving into a steady upward fill — by progress=100 the fill covers the
// artwork edge to edge and the breath is masked out behind it.
export const FILL_TRANSITION_START = 70;

// ── Number exit ─────────────────────────────────────────────────────────

// Duration of the number's slide-down exit animation, in milliseconds.
// Used both inline on the exit `transition` and to gate when the welcome
// copy + Continue button are allowed to mount — they don't appear until
// the number has fully cleared the row so the two don't visually overlap.
// A small buffer is added on the gate side, not here, so the exit easing
// curve stays unchanged.
export const NUMBER_EXIT_MS = 550;
export const POST_NUMBER_BUFFER_MS = 80;

// ── Split-text intro ────────────────────────────────────────────────────

// Split-text entry for the percent block. Each character of the placeholder
// `0%` slides up from below an `overflow-hidden` baseline; chars are
// staggered so the eye follows the reveal across the line. Pure Y motion —
// no opacity animation. Once the reveal completes we swap the markup to a
// live `{count}%` so subsequent ticks update without re-animating the
// individual glyphs.
export const SPLIT_TEXT_CHARS = ['0', '%'] as const;
export const SPLIT_TEXT_DELAY_S = 0.5;
export const SPLIT_TEXT_CHAR_DURATION_S = 0.8;
export const SPLIT_TEXT_STAGGER_S = 0.12;
export const SPLIT_TEXT_TOTAL_MS =
  (SPLIT_TEXT_DELAY_S +
    (SPLIT_TEXT_CHARS.length - 1) * SPLIT_TEXT_STAGGER_S +
    SPLIT_TEXT_CHAR_DURATION_S) *
  1000;

// ── Corner brackets ─────────────────────────────────────────────────────

// L-shaped corner brackets that frame the welcome copy once it has finished
// sliding in. The two text lines slide for 1.1 s (first line) + 0.1 s stagger
// (second line) = 1.2 s; we hold the brackets at scale 0 until just after
// that so they only appear once the text has come to rest. Each corner is
// two thin lines that grow outward from the corner point via scaleX/scaleY
// (transform-origin pinned at the corner) so the stroke reads as "drawn"
// out of the corner. All four corners share the same delay so they render
// simultaneously rather than sweeping around the box.
export const CORNER_DELAY_S = 0.5;
export const CORNER_DURATION_S = 10;
export const CORNER_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Four corner anchors. Each entry pairs the Tailwind position utilities
// (offsetting the bracket slightly outside the wrapper box so the L sits
// in the margin, not over the text) with the CSS transform-origin that
// pins each line's scale anchor at the same corner — that's what makes
// the strokes grow *outward from* the corner rather than from the
// element's centre.
//
// Critical detail: the position utilities here are applied directly to
// each line element (no wrapper). For the right- and bottom-anchored
// corners we use `-right-2 / -bottom-2`, which puts the *line's* right
// or bottom edge at the corner point; combined with the matching
// `100% …` transform-origin, the scale animation collapses the line
// onto that edge so the bracket point stays exactly where we want it.
export const CORNER_ANCHORS = [
  { position: '-top-5 -left-5 md:-top-7 md:-left-7', origin: '0% 0%' },
  { position: '-top-5 -right-5 md:-top-7 md:-right-7', origin: '100% 0%' },
  { position: '-bottom-5 -left-5 md:-bottom-7 md:-left-7', origin: '0% 100%' },
  {
    position: '-bottom-5 -right-5 md:-bottom-7 md:-right-7',
    origin: '100% 100%',
  },
] as const;

// ── Scramble-to-reveal ──────────────────────────────────────────────────

// Scramble-to-reveal text effect for the welcome copy and Continue label.
// While the parent slide is in flight, the visible characters cycle
// through random glyphs every SCRAMBLE_INTERVAL_MS; once `revealStartMs`
// elapses (each instance is sized to match its parent's slide duration),
// the real characters lock in left-to-right at REVEAL_STAGGER_MS apart.
//
// Width is locked to the final text's natural width via an invisible
// measurement span underneath the scramble overlay — without this, the
// random glyphs (different widths in a proportional font like Space
// Grotesk) would jiggle the parent's bounding box on every tick, which
// would in turn drag the corner-bracket frame anchored to its edges.
//
// The full final text is exposed to screen readers via `sr-only` from
// mount, so assistive-tech users get the content immediately regardless
// of which animation phase the sighted view is in.
// Three case-aware scramble pools. The character chosen for each
// unlocked position is drawn from the pool that matches the real
// glyph's case, so width variance between "scrambled" and "real" stays
// small (e.g. a lowercase 'r' won't get replaced by an uppercase 'M',
// which in Space Grotesk is nearly twice as wide). Digits and
// punctuation fall back to the SYMBOL pool which mixes both widths
// roughly evenly.
export const SCRAMBLE_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const SCRAMBLE_LOWER = 'abcdefghijklmnopqrstuvwxyz';
export const SCRAMBLE_SYMBOL = '0123456789!@#$%&*';
export const SCRAMBLE_INTERVAL_MS = 50;
export const REVEAL_STAGGER_MS = 50;

// ── Welcome + continue copy and cascade ─────────────────────────────────

// Slide durations of the three host motion blocks, in ms. Each ScrambleText
// instance uses these as the *minimum* `revealStartMs` so the reveal can
// never start before the slide has actually landed.
export const HEADING_SLIDE_MS = 1100;
export const SUBTITLE_SLIDE_MS = 1200; // 1100 + the 0.1s subtitle delay
export const CONTINUE_SLIDE_MS = 800;

// The three welcome lines (heading + subtitle line 1 + subtitle line 2)
// reveal in a line-by-line cascade rather than all at once. Each line's
// reveal-start is the previous line's reveal-end (slide-end + char count
// × stagger), with the first line gated by HEADING_SLIDE_MS so it can't
// start before the heading has slid into place. The text strings are
// pulled out as constants so the cascade timings update automatically if
// the copy changes.
export const HEADING_TEXT = 'Welcome to PACT';
export const SUBTITLE_LINE_1 = 'Press continue to login';
export const SUBTITLE_LINE_2 = 'to your pact dashboard';
export const CONTINUE_TEXT = 'Continue';

export const HEADING_REVEAL_START_MS = HEADING_SLIDE_MS;
export const HEADING_REVEAL_END_MS =
  HEADING_REVEAL_START_MS + HEADING_TEXT.length * REVEAL_STAGGER_MS;
// Line 1 of the subtitle waits for the heading's reveal to finish, but
// can never start before the subtitle's own slide lands (in practice
// HEADING_REVEAL_END_MS is the larger of the two, so the slide guard
// is just defensive).
export const SUBTITLE_LINE_1_REVEAL_START_MS = Math.max(
  HEADING_REVEAL_END_MS,
  SUBTITLE_SLIDE_MS
);
export const SUBTITLE_LINE_2_REVEAL_START_MS =
  SUBTITLE_LINE_1_REVEAL_START_MS + SUBTITLE_LINE_1.length * REVEAL_STAGGER_MS;

// ── Exit transition (splash → destination) ──────────────────────────────

// On Continue, the splash visual is frozen and rendered twice — once
// clipped to the top half of the viewport, once to the bottom half. A
// thin horizontal seam line draws across the centre first (rendered as
// two overlapping strokes, one pinned to the bottom edge of the top
// half and one to the top edge of the bottom half); the two clipped
// copies then slide off-screen (top → up, bottom → down) and each
// stroke rides along with its half, so the single seam visibly splits
// into two and travels offstage. router.replace fires at the end of
// the slide; because the splash bg matches the destination bg, the
// unmount → mount swap is invisible.

// Seam line draws across the centre before the halves move. Deliberate
// pace — slow enough to register as a "cut", not a flash.
export const SPLIT_LINE_DRAW_S = 0.4;
export const SPLIT_LINE_DRAW_EASE: [number, number, number, number] = [
  0.16, 1, 0.3, 1,
];

// Once the seam has drawn, hold for a beat so the eye registers "the
// screen is about to split". Without this beat the slide reads as the
// line itself dragging the halves apart, not as a separate phase.
export const SPLIT_SLIDE_DELAY_S = SPLIT_LINE_DRAW_S + 0.2;

// Halves slide off-screen — strong ease-in/out cubic so the motion is
// felt as decisive (slow start, fast middle, soft landing offstage).
// 1.4 s gives the reveal real weight: the viewer has time to watch the
// splash physically pull apart instead of just blinking out.
export const SPLIT_SLIDE_S = 1.4;
export const SPLIT_SLIDE_EASE: [number, number, number, number] = [
  0.83, 0, 0.17, 1,
];

// Total duration of the exit transition in ms — used to schedule the
// router.replace so it fires the instant the halves have cleared.
export const SPLIT_TOTAL_MS = (SPLIT_SLIDE_DELAY_S + SPLIT_SLIDE_S) * 1000;

// ── Throttle ────────────────────────────────────────────────────────────

// sessionStorage key for the "splash already played this session" flag.
// Prefixed with `pact:` so it's grep-able and can't collide with any third-
// party SDK that decides to squat on a bare `splash` key. Scoped to the
// tab session by sessionStorage — closing the tab clears it and the next
// app-open gets a fresh splash. See `splash_throttle.ts`.
export const SPLASH_SESSION_KEY = 'pact:splash:shown';
