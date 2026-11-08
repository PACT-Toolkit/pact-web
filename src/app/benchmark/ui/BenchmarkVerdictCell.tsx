import {
  isMitigatedRow,
  rowAttemptsMarker,
  rowVerdictKind,
} from '@/src/app/benchmark/domain/benchmark_run_rows';
import { BenchmarkMitigatedBadge } from '@/src/app/benchmark/ui/BenchmarkMitigatedBadge';
import { BenchmarkVerdictChip } from '@/src/app/benchmark/ui/BenchmarkVerdictChip';

interface BenchmarkVerdictCellProps {
  row: {
    decision?: string;
    error?: string;
    throttled?: boolean;
    unscored?: boolean;
    reason?: string;
    redacted?: boolean;
    attempts?: number;
  };
}

/**
 * The decision of one benchmark row. An errored, throttled, or unscored row
 * never shows its decision as a verdict: it is empty or the gateway's
 * fail-open allow, not something the classifier decided. A mitigated row keeps
 * its verdict and gains a badge: the gateway masked content instead of
 * blocking. A row that needed more than one request carries a muted "×N"
 * marker next to its verdict.
 */
export const BenchmarkVerdictCell = ({ row }: BenchmarkVerdictCellProps) => {
  switch (rowVerdictKind(row)) {
    case 'error':
      return <span className="text-xs text-destructive">error</span>;
    case 'throttled':
      return (
        <span
          className="text-xs text-muted-foreground"
          title="The gateway throttled this request; it was not scored."
        >
          throttled
        </span>
      );
    case 'unscored':
      return (
        <span
          className="text-xs text-muted-foreground"
          title="The classifier gave no verdict; the gateway allowed the request by default."
        >
          unscored
        </span>
      );
    case 'verdict': {
      const attempts = rowAttemptsMarker(row.attempts);

      return (
        <span className="inline-flex items-center gap-1.5">
          <BenchmarkVerdictChip text={row.decision || '-'} />
          {isMitigatedRow(row) && (
            <BenchmarkMitigatedBadge redacted={Boolean(row.redacted)} />
          )}
          {attempts && (
            <span
              data-testid="benchmark-row-attempts"
              title={attempts.title}
              className="font-mono text-xs text-muted-foreground"
            >
              {attempts.text}
            </span>
          )}
        </span>
      );
    }
  }
};
