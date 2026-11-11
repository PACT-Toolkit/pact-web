import { useXAxisScale } from 'recharts';

import { type CategoryChartPoint } from '@/src/app/benchmark/domain/benchmark_category_chart';

/** Gap between the end of the upper whisker and the label text. */
const LABEL_GAP_PX = 6;

/** Which of a category's two bars a label belongs to. */
export type BenchmarkCategoryBarSeries = 'detection' | 'fp';

interface BenchmarkCategoryBarLabelProps {
  series: BenchmarkCategoryBarSeries;
  points: readonly CategoryChartPoint[];
  /**
   * Bar geometry and the category name (the `LabelList` `dataKey`), injected
   * by recharts. The name, not the label index, identifies the point: bars
   * without a rectangle are dropped from the label list, which shifts indexes.
   */
  y?: number | string;
  height?: number | string;
  value?: unknown;
}

/**
 * Bar-end label for the per-category chart: the "<hits>/<rows>" fraction,
 * then the category's counters in the warning colour. It starts right of the
 * end of the bar's upper Wilson whisker, never on top of it, and is placed
 * from the x scale rather than the bar rectangle because a 0% bar is only a
 * sliver. Rendered by `LabelList`, which draws nothing for a bar that has no
 * rectangle (an undefined rate).
 */
export const BenchmarkCategoryBarLabel = ({
  series,
  points,
  y,
  height,
  value,
}: BenchmarkCategoryBarLabelProps) => {
  const xScale = useXAxisScale();
  const point = points.find((p) => p.category === value);
  const interval =
    series === 'detection' ? point?.detectionInterval : point?.fpInterval;
  const barTop = Number(y);
  const barHeight = Number(height);

  if (!point || !interval || !xScale || Number.isNaN(barTop + barHeight)) {
    return null;
  }

  const whiskerEnd = xScale(interval.high);
  if (whiskerEnd === undefined) return null;

  const count = series === 'detection' ? point.detectionCount : point.fpCount;
  const note = series === 'detection' ? point.detectionNote : point.fpNote;

  return (
    <text
      x={whiskerEnd + LABEL_GAP_PX}
      y={barTop + barHeight / 2}
      dominantBaseline="central"
      className="text-[10px]"
      data-testid={`benchmark-category-${series}-label`}
    >
      <tspan className="fill-muted-foreground">{count}</tspan>
      {note && <tspan className="fill-warning">{` · ${note}`}</tspan>}
    </text>
  );
};
