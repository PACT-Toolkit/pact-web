import { type ImgHTMLAttributes } from 'react';

import { cn } from '@/src/lib/utils';

// The PACT mark, served from `public/assets/images/pact-mark.svg` (the
// cleaned version of the brand SVG — original minus its black backdrop).
// The remaining paths use light-grey fills (#f8f8f8 → #323232) designed to
// sit on a dark surface. To make it theme-aware without losing the subtle
// depth/shading those fills give, we invert in light mode (`invert`) and
// leave it alone in dark mode (`dark:invert-0`).
export const PactMark = ({
  className,
  alt = '',
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src="/assets/images/pact-mark.svg"
    alt={alt}
    className={cn('invert select-none dark:invert-0', className)}
    {...props}
  />
);
