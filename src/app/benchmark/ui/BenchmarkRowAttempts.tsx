import { rowAttemptsMarker } from '@/src/app/benchmark/domain/benchmark_run_rows';

interface BenchmarkRowAttemptsProps {
  attempts?: number;
}

/** Muted "×N" marker for a row that needed more than one request; nothing otherwise. */
export const BenchmarkRowAttempts = ({
  attempts,
}: BenchmarkRowAttemptsProps) => {
  const marker = rowAttemptsMarker(attempts);
  if (!marker) return null;

  return (
    <span
      data-testid="benchmark-row-attempts"
      title={marker.title}
      className="font-mono text-xs text-muted-foreground"
    >
      {marker.text}
    </span>
  );
};
