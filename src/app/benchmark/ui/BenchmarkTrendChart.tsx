'use client';

import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { type TrendDateRange } from '@/src/app/benchmark/domain/benchmark_run';
import {
  formatRunTimestamp,
  trendChartData,
  TREND_SERIES,
  type TrendChartPoint,
} from '@/src/app/benchmark/domain/benchmark_trend';
import { useBenchmarkRuns } from '@/src/app/benchmark/domain/use_benchmark_runs';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/src/components/ui/chart';
import { computeTimeAxisScale } from '@/src/framework/charts/time_axis';
import { chartRunTimestampLabelFormatter } from '@/src/framework/charts/tooltip_run_timestamp_label';
import { abbreviateHash } from '@/src/framework/format/abbreviate_hash';
import { buildLabel } from '@/src/framework/format/build_label';
import { formatDayTick } from '@/src/framework/format/day_tick_format';
import { formatMetric } from '@/src/framework/format/metric_format';

interface BenchmarkTrendChartProps {
  dateRange: TrendDateRange;
}

export const BenchmarkTrendChart = ({
  dateRange,
}: BenchmarkTrendChartProps) => {
  const { runs, isLoading, error } = useBenchmarkRuns(dateRange);

  const chartData = useMemo(() => trendChartData(runs), [runs]);
  const timeAxis = useMemo(
    () => computeTimeAxisScale(chartData.map((d) => d.ran_at)),
    [chartData]
  );

  return (
    <Card data-testid="benchmark-trend-chart">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Detection &amp; FP rate over time
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : error ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <p>Couldn&apos;t load benchmark runs.</p>
            <p className="text-xs">Try refreshing in a moment.</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <p>No benchmark runs recorded yet.</p>
            <p className="text-xs">
              Upload a corpus and run a benchmark to start tracking trends.
            </p>
          </div>
        ) : (
          <ChartContainer config={TREND_SERIES} className="h-64 w-full">
            <LineChart
              data={chartData}
              margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="ran_at"
                type="number"
                scale="time"
                domain={timeAxis.domain}
                ticks={timeAxis.ticks}
                tickFormatter={formatDayTick}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `${v}%`}
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                padding={{ top: 12, bottom: 12 }}
                width={36}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={chartRunTimestampLabelFormatter<TrendChartPoint>(
                      formatRunTimestamp
                    )}
                    formatter={(value, name, item) => {
                      const p = item.payload as TrendChartPoint | undefined;
                      const seriesKey = name as keyof typeof TREND_SERIES;
                      const percent =
                        typeof value === 'number' ? value : Number(value);

                      return (
                        <div className="flex w-full flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">
                              {TREND_SERIES[seriesKey]?.label ?? name}
                            </span>
                            <span className="font-mono font-medium">
                              {formatMetric(percent / 100, 'percent')}
                            </span>
                          </div>
                          {p && seriesKey === 'fp_rate' && (
                            <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                              <span>Rows: {p.row_count}</span>
                              <span>
                                Corpus: {abbreviateHash(p.corpus_version)}
                              </span>
                              <span>
                                Build: {buildLabel(p.engine, p.gateway_version)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                }
              />
              <Line
                dataKey="detection_rate"
                type="monotone"
                stroke="var(--color-detection_rate)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--color-detection_rate)' }}
                activeDot={{ r: 5 }}
              />
              <Line
                dataKey="fp_rate"
                type="monotone"
                stroke="var(--color-fp_rate)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--color-fp_rate)' }}
                activeDot={{ r: 5 }}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
