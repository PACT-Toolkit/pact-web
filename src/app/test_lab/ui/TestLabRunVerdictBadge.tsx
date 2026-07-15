import { type TestRun } from '@/src/app/test_lab/domain/test_lab_check';

// TestLabRunVerdictBadge renders a run-history row's verdict. A failed run
// (status === 'error') has no gateway decision, so it gets a distinct FAILED
// treatment -- amber/warning, not the allow-green or block-red used for a
// completed check -- rather than falling through to a misleading green
// ALLOW. See TestLabDecisionBadge for the (separate) per-layer pipeline
// badge this mirrors stylistically.
export const TestLabRunVerdictBadge = ({ run }: { run: TestRun }) => {
  if (run.status === 'error') {
    return (
      <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 font-mono font-semibold text-amber-600 dark:text-amber-400">
        FAILED
      </span>
    );
  }

  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 font-mono font-semibold ${
        run.decision === 'block'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-green-500/10 text-green-600 dark:text-green-400'
      }`}
    >
      {run.decision.toUpperCase()}
    </span>
  );
};
