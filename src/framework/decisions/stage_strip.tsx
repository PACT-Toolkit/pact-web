import { Brain } from 'lucide-react';

import {
  PIPELINE_STAGE_ICON,
  PIPELINE_STAGE_LABEL,
  type PipelineStageId,
} from '@/src/framework/decisions/pipeline_stage';

// Compact, read-only per-stage strip (PACT-748): one chip per pipeline stage
// that fired on this request, the blocking stage picked out in red -- the
// same at-a-glance stage attribution the Test Lab's pipeline card gives an
// interactive run, applied to an audit row that only ever renders once.
// Callers resolve `stages` from whichever wire type they hold (audit's
// DecisionPayload today; see audit_decision_stage_strip.ts) -- this
// component only knows the closed stage-id vocabulary and a blocked flag,
// mirroring CausalSpanList's loosely-typed-prop precedent so it never needs
// to import either wire contract.
export const StageStrip = ({
  stages,
  testId,
}: {
  stages: { id: PipelineStageId; blocked: boolean }[];
  testId?: string;
}) => {
  if (stages.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid={testId}>
      {stages.map(({ id, blocked }) => {
        const Icon = PIPELINE_STAGE_ICON[id] ?? Brain;

        return (
          <span
            key={id}
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${
              blocked
                ? 'bg-destructive/10 text-destructive'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Icon className="h-3 w-3" aria-hidden />
            {PIPELINE_STAGE_LABEL[id]}
          </span>
        );
      })}
    </div>
  );
};
