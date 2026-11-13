import { type BenchmarkAdaptiveCampaignResultBody } from '@/src/__codegen__/rest/benchmark';
import {
  ADAPTIVE_OUTCOMES,
  formatAsr,
  formatAsrInterval,
} from '@/src/app/benchmark/domain/benchmark_adaptive_campaign';

interface BenchmarkAdaptiveResultProps {
  result: BenchmarkAdaptiveCampaignResultBody;
}

const Stat = ({
  label,
  value,
  detail,
  testId,
}: {
  label: string;
  value: string;
  detail?: string;
  testId: string;
}) => (
  <div className="flex min-w-0 flex-col gap-1" data-testid={testId}>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    {detail && (
      <dd className="text-xs text-muted-foreground tabular-nums">{detail}</dd>
    )}
  </div>
);

export const BenchmarkAdaptiveResult = ({
  result,
}: BenchmarkAdaptiveResultProps) => (
  <div className="flex flex-col gap-4" data-testid="benchmark-adaptive-result">
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Stat
        testId="benchmark-adaptive-asr-all"
        label="ASR (all)"
        value={formatAsr(result.asr)}
        detail={`95% CI ${formatAsrInterval(result.asr_ci_lower, result.asr_ci_upper)}`}
      />
      <Stat
        testId="benchmark-adaptive-asr-attackable"
        label="ASR (attackable)"
        value={formatAsr(result.asr_attackable)}
        detail={`95% CI ${formatAsrInterval(result.asr_attackable_ci_lower, result.asr_attackable_ci_upper)} - ${result.attackable_goals} attackable goals`}
      />
      <Stat
        testId="benchmark-adaptive-succeeded"
        label="Goals succeeded"
        value={`${result.goals_succeeded} / ${result.goals_total}`}
      />
    </dl>

    <dl
      className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4"
      data-testid="benchmark-adaptive-outcomes"
    >
      {ADAPTIVE_OUTCOMES.map(({ key, label }) => (
        <div key={key} className="flex items-baseline justify-between gap-2">
          <dt className="min-w-0 text-muted-foreground">{label}</dt>
          <dd className="font-medium tabular-nums">{result[key]}</dd>
        </div>
      ))}
    </dl>
  </div>
);
