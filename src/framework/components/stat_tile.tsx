import { cn } from '@/src/lib/utils';

interface StatTileProps {
  label: string;
  value: string | number;
  /** Extra classes applied to the value text (e.g. a status color). */
  valueClass?: string;
  /** 'lg' (default) for a headline stat, 'sm' for a dense grid of many tiles. */
  size?: 'sm' | 'lg';
  className?: string;
  testId?: string;
}

/**
 * A bordered label/value tile for a stat grid. Generic and feature-agnostic -
 * promoted to framework because the same `{label, value}` tile was
 * independently re-implemented per feature (dashboard, filter, policy,
 * gateway) before this extraction; new call sites should use this instead of
 * adding another copy. See the benchmark confusion-matrix tiles and the
 * gateway enforcement panel's config grid for current consumers.
 */
export const StatTile = ({
  label,
  value,
  valueClass,
  size = 'lg',
  className,
  testId,
}: StatTileProps) => (
  <div
    data-testid={testId}
    className={cn('flex flex-col gap-1 rounded-lg border p-4', className)}
  >
    <span className="text-xs text-muted-foreground">{label}</span>
    <span
      className={cn(
        'font-semibold tabular-nums',
        size === 'lg' ? 'text-2xl' : 'text-sm',
        valueClass
      )}
    >
      {value}
    </span>
  </div>
);
