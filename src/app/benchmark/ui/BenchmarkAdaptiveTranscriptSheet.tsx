'use client';

import { adaptiveOutcomeLabel } from '@/src/app/benchmark/domain/benchmark_adaptive_campaign';
import { useBenchmarkAdaptiveGoal } from '@/src/app/benchmark/domain/use_benchmark_adaptive_goal';
import { BenchmarkAdaptiveAttempt } from '@/src/app/benchmark/ui/BenchmarkAdaptiveAttempt';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/src/components/ui/sheet';

interface BenchmarkAdaptiveTranscriptSheetProps {
  campaignId: string | null;
  /** The open goal; null keeps the sheet closed and the read disabled. */
  goalId: string | null;
  onClose: () => void;
}

export const BenchmarkAdaptiveTranscriptSheet = ({
  campaignId,
  goalId,
  onClose,
}: BenchmarkAdaptiveTranscriptSheetProps) => {
  const { goal, isLoading, failed } = useBenchmarkAdaptiveGoal(
    campaignId,
    goalId
  );

  return (
    <Sheet open={goalId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-2xl"
        data-testid="benchmark-adaptive-transcript"
      >
        <SheetHeader>
          <SheetTitle className="font-mono text-sm break-all">
            {goalId}
          </SheetTitle>
          <SheetDescription>
            {goal
              ? `${goal.category} - ${adaptiveOutcomeLabel(goal.outcome)} - ${goal.queries_used} queries`
              : 'Goal transcript'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              Couldn&apos;t load this goal transcript.
            </p>
          )}
          {goal && (
            <>
              {goal.error && (
                <p
                  role="alert"
                  className="text-sm break-words text-destructive"
                >
                  {goal.error}
                </p>
              )}
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Final candidate</p>
                <div
                  className="rounded bg-muted p-2 font-mono text-xs break-words whitespace-pre-wrap"
                  data-testid="benchmark-adaptive-final-candidate"
                >
                  {goal.final_candidate || '-'}
                </div>
              </div>
              {goal.attempts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No attempts were recorded for this goal.
                </p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {goal.attempts.map((attempt) => (
                    <BenchmarkAdaptiveAttempt
                      key={attempt.attempt}
                      attempt={attempt}
                    />
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
