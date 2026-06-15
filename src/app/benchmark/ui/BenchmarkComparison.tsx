'use client';

import { useMemo, useState } from 'react';

import {
  compareRuns,
  defaultComparisonPair,
  formatDelta,
  formatMetric,
  runOptionLabel,
  type DeltaDirection,
} from '@/src/app/benchmark/domain/benchmark_comparison';
import { useBenchmarkRuns } from '@/src/app/benchmark/domain/use_benchmark_runs';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { cn } from '@/src/lib/utils';

const DELTA_CLASS: Record<DeltaDirection, string> = {
  improved: 'text-green-600 dark:text-green-400',
  regressed: 'text-destructive',
  neutral: 'text-muted-foreground',
};

export const BenchmarkComparison = () => <BenchmarkComparisonPanel />;

const RunSelect = ({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}) => (
  <label htmlFor={id} className="flex flex-1 flex-col gap-1">
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

const BenchmarkComparisonPanel = () => {
  const { runs, isLoading } = useBenchmarkRuns('all');

  const byNewest = useMemo(
    () => [...runs].sort((a, b) => b.ran_at - a.ran_at),
    [runs]
  );
  const defaults = useMemo(() => defaultComparisonPair(runs), [runs]);

  const [selBaseline, setSelBaseline] = useState<string | null>(null);
  const [selCandidate, setSelCandidate] = useState<string | null>(null);

  const options = useMemo(
    () => byNewest.map((r) => ({ id: r.id, label: runOptionLabel(r) })),
    [byNewest]
  );

  const baselineId = selBaseline ?? defaults?.baselineId ?? null;
  const candidateId = selCandidate ?? defaults?.candidateId ?? null;
  const baseline = byNewest.find((r) => r.id === baselineId);
  const candidate = byNewest.find((r) => r.id === candidateId);

  const metrics = useMemo(
    () => (baseline && candidate ? compareRuns(baseline, candidate) : []),
    [baseline, candidate]
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Run comparison</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : runs.length < 2 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <p>Not enough runs to compare.</p>
            <p className="text-xs">
              Run at least two benchmarks to compare detection rate, FP rate,
              and latency.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <RunSelect
                id="benchmark-compare-baseline"
                label="Baseline"
                value={baselineId ?? ''}
                options={options}
                onChange={setSelBaseline}
              />
              <RunSelect
                id="benchmark-compare-candidate"
                label="Candidate"
                value={candidateId ?? ''}
                options={options}
                onChange={setSelCandidate}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-3 py-2 font-medium">
                      Metric
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium tabular-nums"
                    >
                      Baseline
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium tabular-nums"
                    >
                      Candidate
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium tabular-nums"
                    >
                      Δ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr
                      key={m.key}
                      className="border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-3 py-2">{m.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatMetric(m.baseline, m.format)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatMetric(m.candidate, m.format)}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right tabular-nums font-medium',
                          DELTA_CLASS[m.deltaDirection]
                        )}
                      >
                        {m.delta === 0 ? '—' : formatDelta(m.delta, m.format)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
