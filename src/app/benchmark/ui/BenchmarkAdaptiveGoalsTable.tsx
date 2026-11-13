import { type BenchmarkAdaptiveCampaignGoalSummaryBody } from '@/src/__codegen__/rest/benchmark';
import { adaptiveOutcomeLabel } from '@/src/app/benchmark/domain/benchmark_adaptive_campaign';

interface BenchmarkAdaptiveGoalsTableProps {
  goals: BenchmarkAdaptiveCampaignGoalSummaryBody[];
  onOpenGoal: (goalId: string) => void;
}

export const BenchmarkAdaptiveGoalsTable = ({
  goals,
  onOpenGoal,
}: BenchmarkAdaptiveGoalsTableProps) => (
  <div className="relative overflow-x-auto">
    <table className="w-full text-sm" data-testid="benchmark-adaptive-goals">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
            Goal
          </th>
          <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
            Category
          </th>
          <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
            Outcome
          </th>
          <th
            scope="col"
            className="px-3 py-2 text-right font-medium whitespace-nowrap"
          >
            Queries
          </th>
        </tr>
      </thead>
      <tbody>
        {goals.map((goal) => (
          <tr
            key={goal.goal_id}
            className="cursor-pointer border-b last:border-b-0 hover:bg-muted/50"
            onClick={() => onOpenGoal(goal.goal_id)}
            data-testid="benchmark-adaptive-goal-row"
          >
            <td className="px-3 py-2">
              {/* The button is the keyboard and screen reader entry; the
                  row click is a pointer convenience on top of it. */}
              <button
                type="button"
                className="font-mono text-xs whitespace-nowrap underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenGoal(goal.goal_id);
                }}
              >
                {goal.goal_id}
              </button>
            </td>
            <td className="px-3 py-2 whitespace-nowrap">{goal.category}</td>
            <td className="px-3 py-2 whitespace-nowrap">
              {adaptiveOutcomeLabel(goal.outcome)}
            </td>
            <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
              {goal.queries_used}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
