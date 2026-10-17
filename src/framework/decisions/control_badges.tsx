import { type ControlRef } from '@/src/__codegen__/schema/pact-decisions';
import { controlLabel } from '@/src/framework/decisions/control_frameworks';

// One small badge per control. Callers pass an already de-duplicated list
// (collectDecisionControls); renders nothing when empty so older events
// without the mapping show no placeholder.
export const DecisionControlBadges = ({
  controls,
  'data-testid': testId,
}: {
  controls: ControlRef[];
  'data-testid'?: string;
}) => {
  if (controls.length === 0) return null;

  return (
    <span className="flex flex-wrap items-center gap-1.5" data-testid={testId}>
      {controls.map((control) => (
        <code
          key={`${control.framework}:${control.id}`}
          className="rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-700 dark:text-blue-300"
          title={`${control.framework} / ${control.id}`}
        >
          {controlLabel(control)}
        </code>
      ))}
    </span>
  );
};
