'use client';

import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { type TrendDateRange } from '@/src/app/benchmark/domain/benchmark_run';
import {
  formatRunTimestamp,
  latencyChartData,
  LATENCY_SERIES,
  type LatencyChartPoint,
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
import { formatLatencyTick } from '@/src/framework/format/latency_tick_format';
import { formatMetric } from '@/src/framework/format/metric_format';

interface BenchmarkLatencyChartProps {
  dateRange: TrendDateRange;
}

export const BenchmarkLatencyChart = ({
  dateRange,
}: BenchmarkLatencyChartProps) => {
  const { runs, isLoading, error } = useBenchmarkRuns(dateRange);

  const chartData = useMemo(() => latencyChartData(runs), [runs]);
  const timeAxis = useMemo(
    () => computeTimeAxisScale(chartData.map((d) => d.ran_at)),
    [chartData]
  );
  const maxLatency = useMemo(
    () => Math.max(0, ...chartData.map((d) => d.p99_latency)),
    [chartData]
  );

  return (
    <Card data-testid="benchmark-latency-chart">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Latency over time</CardTitle>
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
              Upload a corpus and run a benchmark to start tracking latency.
            </p>
          </div>
        ) : (
          <ChartContainer config={LATENCY_SERIES} className="h-64 w-full">
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
                tickFormatter={formatLatencyTick}
                domain={[0, maxLatency]}
                tickCount={5}
                allowDecimals={false}
                padding={{ top: 12, bottom: 0 }}
                width={72}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={chartRunTimestampLabelFormatter<LatencyChartPoint>(
                      formatRunTimestamp
                    )}
                    formatter={(value, name, item) => {
                      const p = item.payload as LatencyChartPoint | undefined;
                      const seriesKey = name as keyof typeof LATENCY_SERIES;
                      const ms =
                        typeof value === 'number' ? value : Number(value);

                      return (
                        <div className="flex w-full flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">
                              {LATENCY_SERIES[seriesKey]?.label ?? name}
                            </span>
                            <span className="font-mono font-medium">
                              {formatMetric(ms, 'ms')}
                            </span>
                          </div>
                          {p && seriesKey === 'p99_latency' && (
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
                dataKey="p50_latency"
                type="monotone"
                stroke="var(--color-p50_latency)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--color-p50_latency)' }}
                activeDot={{ r: 5 }}
              />
              <Line
                dataKey="p99_latency"
                type="monotone"
                stroke="var(--color-p99_latency)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--color-p99_latency)' }}
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
