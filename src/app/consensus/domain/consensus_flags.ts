import {
  type ConsensusSubObject,
  type ConsensusVote,
} from '@/src/app/consensus/domain/consensus_record';

// Display-only heuristic for flagging a consensus verdict as "low
// confidence" in the console UI. This is NOT an enforcement value -- it
// never blocks/allows a request (that's PACT_CONSENSUS_THRESHOLD in
// pact-gateway, a separate config). It only decides whether the console
// highlights a row for operator attention, and can move without
// coordinating with any backend enforcement threshold.
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

// Two or more votes present with differing labels -- the backends
// disagreed on the verdict even though a label eventually won on
// aggregate. Votes with no label (never expected in practice, but the
// wire type allows it) are excluded from the distinct-label count rather
// than treated as agreeing or disagreeing.
export const isSplit = (votes: ConsensusVote[] | undefined): boolean => {
  if (!votes || votes.length < 2) return false;

  const labels = new Set(
    votes
      .map((vote) => vote.label)
      .filter((label): label is string => Boolean(label))
  );

  return labels.size >= 2;
};

// Strict on quorum_reached === false -- an absent field (older payloads
// that predate the flag) is treated as "unknown", not "no quorum".
export const isNoQuorum = (
  consensus: ConsensusSubObject | undefined
): boolean => consensus?.quorum_reached === false;

// skipped=true signals a transport-error fail-open: pact-gateway couldn't
// reach the consensus backend in time and fell back to the classifier's
// own verdict. Surfaced prominently since a red-teamer probing for a
// transport-level bypass would look exactly like this.
export const isFailOpen = (
  consensus: ConsensusSubObject | undefined
): boolean => consensus?.skipped === true;

// Undefined confidence can't be asserted as low -- only a present,
// below-threshold value counts.
export const isLowConfidence = (
  consensus: ConsensusSubObject | undefined
): boolean =>
  typeof consensus?.confidence === 'number' &&
  consensus.confidence < LOW_CONFIDENCE_THRESHOLD;

// True when any single flag applies. Shared by the console's "flagged only"
// filter and the record card's highlight-badge row so both agree on what
// counts as "interesting" without duplicating the four rules above.
export const isFlaggedRecord = (
  consensus: ConsensusSubObject | undefined
): boolean =>
  isSplit(consensus?.votes) ||
  isNoQuorum(consensus) ||
  isFailOpen(consensus) ||
  isLowConfidence(consensus);
