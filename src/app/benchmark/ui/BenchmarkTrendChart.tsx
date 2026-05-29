'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import {
  TREND_DATE_RANGES,
  type TrendDateRange,
} from '@/src/app/benchmark/domain/benchmark_run';
import { useBenchmarkRuns } from '@/src/app/benchmark/domain/use_benchmark_runs';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/src/components/ui/chart';

const chartConfig = {
  detection_rate: {
    label: 'Detection rate',
    color: 'hsl(var(--chart-1, 217 91% 60%))',
  },
  fp_rate: {
    label: 'FP rate',
    color: 'hsl(var(--chart-2, 0 84% 60%))',
  },
} satisfies ChartConfig;

export const BenchmarkTrendChart = () => {
  const [dateRange, setDateRange] = useState<TrendDateRange>('90d');
  const { runs, isLoading } = useBenchmarkRuns(dateRange);

  const chartData = useMemo(
    () =>
      runs.map((r) => ({
        date: new Date(r.ran_at * 1000).toLocaleDateString('en-GB', {
          month: 'short',
          day: 'numeric',
        }),
        detection_rate: Math.round(r.detection_rate * 1000) / 10,
        fp_rate: Math.round(r.fp_rate * 1000) / 10,
        gateway_version: r.gateway_version,
        engine: r.engine,
      })),
    [runs]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">
          Detection &amp; FP rate over time
        </CardTitle>
        <div className="flex gap-1">
          {TREND_DATE_RANGES.map(({ label, value }) => (
            <Button
              key={value}
              size="sm"
              variant={dateRange === value ? 'secondary' : 'ghost'}
              className="h-7 px-2 text-xs"
              aria-pressed={dateRange === value}
              onClick={() => setDateRange(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <p>No benchmark runs recorded yet.</p>
            <p className="text-xs">
              Upload a corpus and run a benchmark to start tracking trends.
            </p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <LineChart
              data={chartData}
              margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
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
                width={36}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => {
                      const p = item.payload as
                        | Record<string, unknown>
                        | undefined;

                      return (
                        <div className="flex w-full flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">
                              {chartConfig[name as keyof typeof chartConfig]
                                ?.label ?? name}
                            </span>
                            <span className="font-mono font-medium">
                              {value}%
                            </span>
                          </div>
                          {p && (
                            <div className="text-muted-foreground text-[10px]">
                              {String(p.gateway_version ?? '')} ·{' '}
                              {String(p.engine ?? '')}
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
            </LineChart>
          </ChartContainer>
        )}

        {chartData.length > 0 && (
          <div className="mt-3 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            {(['detection_rate', 'fp_rate'] as const).map((key) => (
              <span key={key} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-3 rounded-sm"
                  style={{ backgroundColor: chartConfig[key].color }}
                />
                {chartConfig[key].label}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
