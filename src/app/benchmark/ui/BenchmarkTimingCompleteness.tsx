'use client';

import { useMemo } from 'react';

import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';
import { timingCompletenessView } from '@/src/app/benchmark/domain/benchmark_timing_completeness';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { cn } from '@/src/lib/utils';

interface BenchmarkTimingCompletenessProps {
  run: BenchmarkRun | undefined;
}

/**
 * Per-layer count of answered rows whose layer object carried no
 * `duration_ms`, plus the count of rows with no stages list. Rendered under
 * the stage latency chart for the same run. Zero missing reads as a pass; any
 * missing count takes the warning colour. A run stored before the summary
 * existed shows "not recorded" rather than zeros.
 */
export const BenchmarkTimingCompleteness = ({
  run,
}: BenchmarkTimingCompletenessProps) => {
  const view = useMemo(() => timingCompletenessView(run), [run]);

  // The stage latency chart above already says "Loading" / "No runs".
  if (!run) return null;

  return (
    <Card data-testid="benchmark-timing-completeness">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Timing completeness
        </CardTitle>
      </CardHeader>

      <CardContent>
        {!view.recorded ? (
          <p className="text-sm text-muted-foreground">
            Not recorded for this run.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-3 py-2 font-medium">
                      Layer
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Rows with signal
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Rows missing duration
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {view.layers.map((l) => (
                    <tr
                      key={l.layer}
                      data-testid={`timing-layer-${l.layer}`}
                      data-state={l.missing ? 'missing' : 'pass'}
                      className="border-b last:border-0"
                    >
                      <td className="px-3 py-2 font-mono text-xs">{l.layer}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {l.rowsWithSignal}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right tabular-nums',
                          l.missing
                            ? 'font-medium text-warning'
                            : 'text-muted-foreground'
                        )}
                      >
                        {l.rowsMissingDuration}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p
              data-testid="timing-stages-line"
              data-state={view.stages.missing ? 'missing' : 'pass'}
              className={cn(
                'px-3 text-sm tabular-nums',
                view.stages.missing
                  ? 'font-medium text-warning'
                  : 'text-muted-foreground'
              )}
            >
              Rows missing stages: {view.stages.rowsMissing} of{' '}
              {view.stages.rowsTotal}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
