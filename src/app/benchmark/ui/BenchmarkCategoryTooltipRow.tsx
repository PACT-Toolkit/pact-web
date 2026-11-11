import {
  CATEGORY_SERIES,
  type CategoryChartPoint,
} from '@/src/app/benchmark/domain/benchmark_category_chart';
import { formatMetric } from '@/src/framework/format/metric_format';

type CategorySeriesKey = keyof typeof CATEGORY_SERIES;

interface BenchmarkCategoryTooltipRowProps {
  seriesKey: CategorySeriesKey;
  point: CategoryChartPoint;
}

/** Sample-size line under a series value: the fraction and its 95% interval, or why there is no rate. */
function sampleLine(seriesKey: CategorySeriesKey, p: CategoryChartPoint) {
  const isDetection = seriesKey === 'detectionRate';
  const interval = isDetection ? p.detectionInterval : p.fpInterval;
  if (!interval) return isDetection ? 'no attack rows' : 'no benign rows';

  const hits = isDetection ? p.detected : p.fp;
  const rows = isDetection ? p.attacks : p.benign;
  const kind = isDetection ? 'attack' : 'benign';

  return `${hits} of ${rows} ${kind} rows · 95% CI ${interval.low}-${interval.high}%`;
}

/**
 * One series row of the per-category chart tooltip: the label and value
 * (`n/a` for an undefined rate), the sample size under it and, on the last
 * series row only, the category's error and loss counters so they show once
 * per tooltip rather than under both series.
 */
export const BenchmarkCategoryTooltipRow = ({
  seriesKey,
  point,
}: BenchmarkCategoryTooltipRowProps) => {
  const rate = point[seriesKey];

  return (
    <div className="flex w-full flex-col gap-0.5">
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">
          {CATEGORY_SERIES[seriesKey].label}
        </span>
        <span className="font-mono font-medium">
          {rate === null ? 'n/a' : formatMetric(rate / 100, 'percent')}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
        <span>{sampleLine(seriesKey, point)}</span>
        {seriesKey === 'fpRate' && (
          <>
            {point.errors > 0 && (
              <span className="text-destructive">Errors: {point.errors}</span>
            )}
            {point.mitigated > 0 && (
              <span className="text-warning">Mitigated: {point.mitigated}</span>
            )}
            {point.throttled > 0 && (
              <span className="text-warning">Throttled: {point.throttled}</span>
            )}
            {point.unscored > 0 && (
              <span className="text-warning">Unscored: {point.unscored}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
};
