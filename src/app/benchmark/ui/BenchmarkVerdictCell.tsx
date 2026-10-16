import { rowVerdictKind } from '@/src/app/benchmark/domain/benchmark_run_rows';
import { BenchmarkVerdictChip } from '@/src/app/benchmark/ui/BenchmarkVerdictChip';

interface BenchmarkVerdictCellProps {
  row: {
    decision?: string;
    error?: string;
    throttled?: boolean;
    unscored?: boolean;
  };
}

/**
 * The decision of one benchmark row. An errored, throttled, or unscored row
 * never shows its decision as a verdict: it is empty or the gateway's
 * fail-open allow, not something the classifier decided.
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
    case 'verdict':
      return <BenchmarkVerdictChip text={row.decision || '-'} />;
  }
};
