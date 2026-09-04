import { type ReactNode } from 'react';
import { type TooltipPayloadEntry } from 'recharts';

/**
 * Build a `ChartTooltipContent` `labelFormatter` that reads the raw
 * unix-seconds `ran_at` timestamp off the hovered data point, for any
 * benchmark chart plotting a numeric time axis (`dataKey="ran_at"`).
 *
 * `ChartTooltipContent`'s own label logic (`src/components/ui/chart.tsx`)
 * resolves its `value` against `ChartConfig` entries keyed by the series'
 * `dataKey` whenever the label recharts hands it isn't a string - the right
 * behaviour for a categorical chart, but wrong here: it hands back the
 * series' display label (e.g. "Detection rate") instead of the timestamp,
 * so `formatTimestamp(Number(value))` produced `formatTimestamp(NaN)` -
 * "Invalid Date". Reading the timestamp straight off the first payload
 * entry's own data point instead sidesteps that resolution entirely.
 */
export function chartRunTimestampLabelFormatter<
  TPoint extends { ran_at: number },
>(
  formatTimestamp: (unixSeconds: number) => string
): (
  value: ReactNode,
  payload: ReadonlyArray<TooltipPayloadEntry>
) => ReactNode {
  return (_value, payload) => {
    const point = payload[0]?.payload as TPoint | undefined;

    return point ? formatTimestamp(point.ran_at) : '';
  };
}
