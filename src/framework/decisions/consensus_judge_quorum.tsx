import { type ConsensusDecision } from '@/src/__codegen__/schema/pact-decisions';

type JudgeCounts = Pick<
  ConsensusDecision,
  'backend_count' | 'configured_count' | 'full_quorum'
>;

// "N of M judges" when the event reports how many judges were configured,
// the plain responder count otherwise (events produced before configured_count
// existed): no M is ever invented. Undefined when no judge answered.
export const judgeCountLabel = ({
  backend_count: answered,
  configured_count: configured,
}: JudgeCounts): string | undefined => {
  if (typeof answered !== 'number') return undefined;
  if (typeof configured === 'number' && configured > 0) {
    return `${answered} of ${configured} judges`;
  }

  return answered > 0
    ? `${answered} backend${answered === 1 ? '' : 's'}`
    : undefined;
};

// Strict on false: an absent flag (older events) is unknown, not partial.
export const isPartialQuorum = (consensus: JudgeCounts): boolean =>
  consensus.full_quorum === false;

// Judge count plus, when some configured judge did not answer, a warning
// marker. Shared by every view that shows a consensus verdict.
export const ConsensusJudgeQuorum = ({
  consensus,
}: {
  consensus: JudgeCounts;
}) => {
  const count = judgeCountLabel(consensus);

  return (
    <>
      {count && (
        <span
          className="text-xs text-muted-foreground"
          data-testid="consensus-judge-count"
        >
          {count}
        </span>
      )}
      {isPartialQuorum(consensus) && (
        <span
          className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-300"
          title="Not every configured judge answered this vote"
          data-testid="consensus-partial-quorum"
        >
          {'\u26a0 Partial quorum'}
        </span>
      )}
    </>
  );
};
