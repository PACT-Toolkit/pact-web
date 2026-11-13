import { type BenchmarkAdaptiveCampaignAttemptBody } from '@/src/__codegen__/rest/benchmark';
import {
  formatAttemptLatency,
  formatClassifierScore,
  textOrDash,
} from '@/src/app/benchmark/domain/benchmark_adaptive_attempt';

interface BenchmarkAdaptiveAttemptProps {
  attempt: BenchmarkAdaptiveCampaignAttemptBody;
}

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="font-mono text-xs break-words">{value}</dd>
  </div>
);

/**
 * One attacker attempt. The candidate is attacker-written text, so it only
 * ever renders as a React text node: no HTML, no markdown, never an href or
 * src.
 */
export const BenchmarkAdaptiveAttempt = ({
  attempt,
}: BenchmarkAdaptiveAttemptProps) => (
  <li
    className="flex flex-col gap-3 rounded-md border p-3"
    data-testid="benchmark-adaptive-attempt"
  >
    <p className="text-sm font-medium">Attempt {attempt.attempt}</p>
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Field label="Decision" value={textOrDash(attempt.decision)} />
      <Field
        label="Blocking stage"
        value={textOrDash(attempt.blocking_stage)}
      />
      <Field
        label="Rejection reason"
        value={textOrDash(attempt.rejection_reason)}
      />
      <Field
        label="Classifier label"
        value={textOrDash(attempt.classifier_label)}
      />
      <Field
        label="Classifier score"
        value={formatClassifierScore(attempt.classifier_score)}
      />
      <Field label="Latency" value={formatAttemptLatency(attempt.latency_ms)} />
    </dl>
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">Candidate</p>
      <div
        className="rounded bg-muted p-2 font-mono text-xs break-words whitespace-pre-wrap"
        data-testid="benchmark-adaptive-candidate"
      >
        {attempt.candidate}
      </div>
    </div>
  </li>
);
