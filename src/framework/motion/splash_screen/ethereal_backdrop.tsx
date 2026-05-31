import { Component as EtherealShadow } from '@/src/components/ui/etheral-shadow';

// Ethereal-shadow backdrop — SVG-filter flowing cloud (Unicorn-Studio-
// style, via 21st.dev). A masked PNG shape is organically displaced by an
// `feTurbulence` + `feDisplacementMap` chain whose hue is rotated
// continuously; a noise PNG overlay supplies the film grain. Color is
// mid-gray so the same backdrop reads on both themes — darkens over
// `bg-white`, lightens over `bg-black`. Sits behind everything else
// (`-z-10`) and ignores pointer events.
//
// Wrapper is intentionally oversized (`-inset-8`) so the outer blur ring
// extends past the viewport — otherwise heavy blur reveals a hard
// rectangular edge of unblurred shader at each side.
export const EtherealBackdrop = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute -inset-8 -z-10 blur-xl"
  >
    <EtherealShadow
      color="rgba(128, 128, 128, 1)"
      animation={{ scale: 100, speed: 90 }}
      noise={{ opacity: 0.4, scale: 0.8 }}
      sizing="fill"
    />
  </div>
);
