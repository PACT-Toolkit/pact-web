import { cn } from '@/src/lib/utils';

/**
 * Widest a console page's content grows, 96rem (1536 px). Single source for
 * the page container and for chrome that must line up with it (the passkey
 * enrollment banner).
 */
export const PAGE_CONTENT_MAX_WIDTH_CLASS = 'max-w-[96rem]';

interface PageContainerProps {
  children: React.ReactNode;
  /** Merged after the base classes, so a page can override the gap or switch to a row layout. */
  className?: string;
}

/** The centred, padded, width-capped column every console page renders its content in. */
export const PageContainer = ({ children, className }: PageContainerProps) => (
  <div
    className={cn(
      'mx-auto flex w-full flex-col gap-6 p-8',
      PAGE_CONTENT_MAX_WIDTH_CLASS,
      className
    )}
  >
    {children}
  </div>
);
