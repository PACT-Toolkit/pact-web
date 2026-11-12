import { Input } from '@/src/components/ui/input';
import { cn } from '@/src/lib/utils';

interface DateRangeFilterProps {
  /** `datetime-local` value of the range start; '' when unset. */
  since: string;
  /** `datetime-local` value of the range end; '' when unset. */
  until: string;
  onSinceChange: (value: string) => void;
  onUntilChange: (value: string) => void;
  sinceTestId?: string;
  untilTestId?: string;
  className?: string;
}

/**
 * A Since / Until pair of `datetime-local` inputs laid out as one filter
 * group: side by side from the `sm` breakpoint up, stacked below it, so a
 * filter row wraps the whole range as a unit instead of orphaning "Until".
 * Both inputs carry the same label above them. Promoted to framework because
 * the activity log filter and the compliance window picker each hand-rolled
 * the same pair.
 */
export const DateRangeFilter = ({
  since,
  until,
  onSinceChange,
  onUntilChange,
  sinceTestId,
  untilTestId,
  className,
}: DateRangeFilterProps) => (
  <div
    className={cn(
      'flex w-full flex-col gap-2 sm:w-auto sm:flex-row',
      className
    )}
  >
    <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:w-52">
      Since
      <Input
        type="datetime-local"
        value={since}
        onChange={(event) => onSinceChange(event.target.value)}
        aria-label="Since"
        data-testid={sinceTestId}
      />
    </label>
    <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:w-52">
      Until
      <Input
        type="datetime-local"
        value={until}
        onChange={(event) => onUntilChange(event.target.value)}
        aria-label="Until"
        data-testid={untilTestId}
      />
    </label>
  </div>
);
