'use client';

import {
  describeAblationConfiguration,
  describeAblationRate,
  describeAblationUnknown,
  formatAblationLatency,
  ABLATION_LATENCY_EXPLANATION,
  type AblationConfiguration,
  type AblationRateView,
} from '@/src/app/benchmark/domain/benchmark_ablation';
import { useBenchmarkRunAblation } from '@/src/app/benchmark/domain/use_benchmark_run_ablation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/src/components/ui/tooltip';

interface BenchmarkAblationCardProps {
  runId: string;
}

// A focusable trigger, so the explanation is reachable by keyboard as well
// as by hover.
const HINT_TRIGGER_CLASS =
  'cursor-help rounded-sm underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

/**
 * The derived defense configurations of an ablation run, above the per-row
 * verdicts. Shows nothing for a run that was not started with ablation or
 * does not exist: the rows view already reports an unknown run.
 */
export const BenchmarkAblationCard = ({
  runId,
}: BenchmarkAblationCardProps) => {
  const state = useBenchmarkRunAblation(runId);

  if (state.kind === 'hidden') return null;

  if (state.kind === 'loading') {
    return (
      <p
        className="text-xs text-muted-foreground"
        data-testid="benchmark-ablation-loading"
      >
        Checking for an ablation result…
      </p>
    );
  }

  return (
    <Card data-testid="benchmark-ablation">
      <CardHeader className="flex flex-col gap-1 pb-2">
        <CardTitle className="text-base">Ablation</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-0">
        {state.kind === 'unavailable' ? (
          <p
            className="px-4 pb-4 text-sm text-muted-foreground"
            data-testid="benchmark-ablation-unavailable"
          >
            Ablation result unavailable
          </p>
        ) : (
          <TooltipProvider>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Ablation">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-4 py-2 font-medium">
                      Configuration
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Detection rate
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      False-positive rate
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className={HINT_TRIGGER_CLASS}
                            data-testid="benchmark-ablation-latency-hint"
                          >
                            Latency p50 / p99 (estimated)
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-64">
                          {ABLATION_LATENCY_EXPLANATION}
                        </TooltipContent>
                      </Tooltip>
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Unknown rows
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2 text-right font-medium"
                    >
                      Errors
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {state.configurations.map((configuration) => (
                    <BenchmarkAblationLine
                      key={configuration.name}
                      configuration={configuration}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {state.notes.length > 0 && (
              <ul
                className="flex flex-col gap-1 px-4 pb-4 text-xs text-muted-foreground"
                data-testid="benchmark-ablation-notes"
              >
                {state.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
};

const RateCell = ({ view }: { view: AblationRateView }) => (
  <td className="px-4 py-2 align-top">
    <div className="tabular-nums">{view.value}</div>
    {view.interval && (
      <div className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        {view.interval}
      </div>
    )}
    <div className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
      {view.basis}
    </div>
  </td>
);

const BenchmarkAblationLine = ({
  configuration,
}: {
  configuration: AblationConfiguration;
}) => {
  const unknown = describeAblationUnknown(configuration);

  return (
    <tr
      data-testid="benchmark-ablation-row"
      className="border-b last:border-0 hover:bg-muted/40"
    >
      <th scope="row" className="px-4 py-2 text-left align-top font-medium">
        {describeAblationConfiguration(configuration.name)}
      </th>
      <RateCell
        view={describeAblationRate(
          configuration.detection_rate,
          configuration.detection_ci,
          configuration.true_positives,
          configuration.attacks,
          'attacks'
        )}
      />
      <RateCell
        view={describeAblationRate(
          configuration.fp_rate,
          configuration.fp_ci,
          configuration.false_positives,
          configuration.benign,
          'benign rows'
        )}
      />
      <td className="px-4 py-2 align-top whitespace-nowrap tabular-nums">
        {formatAblationLatency(configuration.estimated_p50_ms)} /{' '}
        {formatAblationLatency(configuration.estimated_p99_ms)}
      </td>
      <td className="px-4 py-2 align-top tabular-nums">
        {unknown.reasons.length === 0 ? (
          unknown.total
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={HINT_TRIGGER_CLASS}
                aria-label={`${unknown.total} unknown rows, show reasons`}
                data-testid="benchmark-ablation-unknown-hint"
              >
                {unknown.total}
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              <ul className="flex flex-col gap-0.5">
                {unknown.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        )}
      </td>
      <td className="px-4 py-2 text-right align-top tabular-nums">
        {configuration.errors}
      </td>
    </tr>
  );
};
