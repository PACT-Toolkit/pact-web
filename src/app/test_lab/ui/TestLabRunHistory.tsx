import { type TestRun } from '@/src/app/test_lab/domain/test_lab_check';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

export const TestLabRunHistory = ({ history }: { history: TestRun[] }) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-base">Test Run History</CardTitle>
      <CardDescription>
        Gateway verdicts for this session. Overrides are not reflected here.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex flex-col divide-y rounded-md border">
        {history.map(run => (
          <div key={run.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
            <span
              className={`rounded px-1.5 py-0.5 font-mono font-semibold ${
                run.decision === 'block'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-green-500/10 text-green-600 dark:text-green-400'
              }`}
            >
              {run.decision.toUpperCase()}
            </span>
            {run.reason && (
              <code className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                {run.reason}
              </code>
            )}
            {run.filterRuleId && (
              <code className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                {run.filterRuleId}
              </code>
            )}
            <span className="flex-1 truncate font-mono text-muted-foreground">
              {run.input.slice(0, 60)}
            </span>
            <span className="shrink-0 text-muted-foreground">{run.latencyMs}ms</span>
            <span className="shrink-0 text-muted-foreground">
              {new Date(run.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);
