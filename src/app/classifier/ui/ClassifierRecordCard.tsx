import { BrainCircuit, SplitSquareHorizontal } from 'lucide-react';

import { type ClassifierRecord } from '@/src/app/classifier/domain/classifier_record';
import { formatTimestamp } from '@/src/lib/format_timestamp';

// Any label other than "benign" is treated as flagged for badge coloring --
// the classifier sub-object's label is a free-form string on the wire (see
// src/lib/decisions/decision_payload.ts), not a closed enum this console can
// exhaustively switch over.
const isFlaggedLabel = (label?: string) => Boolean(label) && label !== 'benign';

// One classifier-stage verdict: label badge, confidence score, engine tag,
// top-level decision, and a badge noting whether consensus arbitrated the
// request. Visually mirrors the badge-row + info-line layout of
// ConsensusRecordCard / RedactorRecordCard without reusing either directly --
// this card has no expandable detail panel (no per-verdict field the console
// can currently surface benefits from a collapsible section, unlike
// redactor's per-span table).
export const ClassifierRecordCard = ({
  record,
}: {
  record: ClassifierRecord;
}) => {
  const { classifier } = record;
  const flagged = isFlaggedLabel(classifier.label);
  const isBlock = record.decision === 'block';

  return (
    <div
      className="flex flex-col gap-2 p-4 text-sm"
      data-testid="classifier-record-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
              flagged
                ? 'bg-destructive/10 text-destructive'
                : 'bg-green-500/10 text-green-600 dark:text-green-400'
            }`}
          >
            <BrainCircuit className="h-3 w-3" aria-hidden />
            {classifier.label ?? 'unknown'}
          </span>
          {typeof classifier.score === 'number' && (
            <span className="text-xs font-medium">
              {(classifier.score * 100).toFixed(0)}% score
            </span>
          )}
          {classifier.engine && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {classifier.engine}
            </span>
          )}
          {record.decision && (
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-xs font-medium ${
                isBlock
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-green-500/10 text-green-600 dark:text-green-400'
              }`}
            >
              {record.decision}
            </span>
          )}
          {record.consensusArbitrated && (
            <span
              className="flex items-center gap-1 rounded bg-purple-500/10 px-1.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300"
              title="Classifier score fell below the consensus threshold; stage 2.5 arbitrated this request"
            >
              <SplitSquareHorizontal className="h-3 w-3" aria-hidden />
              CONSENSUS ARBITRATED
            </span>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatTimestamp(record.createdAt)}
          {record.requestId ? ` · request ${record.requestId}` : ''}
          {typeof record.latencyMs === 'number'
            ? ` · ${record.latencyMs} ms request latency`
            : ''}
        </span>
      </div>
    </div>
  );
};
