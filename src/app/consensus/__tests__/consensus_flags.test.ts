import { describe, expect, it } from 'vitest';

import {
  LOW_CONFIDENCE_THRESHOLD,
  isFailOpen,
  isFlaggedRecord,
  isLowConfidence,
  isNoQuorum,
  isSplit,
} from '@/src/app/consensus/domain/consensus_flags';
import { type ConsensusSubObject } from '@/src/app/consensus/domain/consensus_record';

describe('isSplit', () => {
  it('returns false when votes is undefined', () => {
    expect(isSplit(undefined)).toBe(false);
  });

  it('returns false when votes is empty', () => {
    expect(isSplit([])).toBe(false);
  });

  it('returns false for a single vote', () => {
    expect(isSplit([{ backend_id: 'b1', label: 'hostile', score: 0.9 }])).toBe(
      false
    );
  });

  it('returns false when two votes agree on label', () => {
    expect(
      isSplit([
        { backend_id: 'b1', label: 'hostile', score: 0.9 },
        { backend_id: 'b2', label: 'hostile', score: 0.8 },
      ])
    ).toBe(false);
  });

  it('returns true when two votes disagree on label', () => {
    expect(
      isSplit([
        { backend_id: 'b1', label: 'hostile', score: 0.9 },
        { backend_id: 'b2', label: 'benign', score: 0.7 },
      ])
    ).toBe(true);
  });

  it('excludes votes with a missing label from the distinct-label count', () => {
    // Only one vote actually carries a label -- can't call this split even
    // though there are two entries.
    expect(
      isSplit([
        { backend_id: 'b1', score: 0.9 },
        { backend_id: 'b2', label: 'benign', score: 0.7 },
      ])
    ).toBe(false);
  });

  it('returns true across three or more votes with any disagreement', () => {
    expect(
      isSplit([
        { backend_id: 'b1', label: 'hostile', score: 0.9 },
        { backend_id: 'b2', label: 'hostile', score: 0.8 },
        { backend_id: 'b3', label: 'benign', score: 0.6 },
      ])
    ).toBe(true);
  });
});

describe('isNoQuorum', () => {
  it('returns true when quorum_reached is exactly false', () => {
    expect(isNoQuorum({ quorum_reached: false })).toBe(true);
  });

  it('returns false when quorum_reached is true', () => {
    expect(isNoQuorum({ quorum_reached: true })).toBe(false);
  });

  it('returns false when quorum_reached is absent (older payload)', () => {
    expect(isNoQuorum({})).toBe(false);
  });

  it('returns false when consensus itself is undefined', () => {
    expect(isNoQuorum(undefined)).toBe(false);
  });
});

describe('isFailOpen', () => {
  it('returns true when skipped is exactly true', () => {
    expect(isFailOpen({ skipped: true, quorum_reached: false })).toBe(true);
  });

  it('returns false when skipped is absent', () => {
    expect(isFailOpen({ quorum_reached: true })).toBe(false);
  });

  it('returns false when skipped is false', () => {
    expect(isFailOpen({ skipped: false, quorum_reached: true })).toBe(false);
  });

  it('returns false when consensus itself is undefined', () => {
    expect(isFailOpen(undefined)).toBe(false);
  });
});

describe('isLowConfidence', () => {
  it('returns false when confidence is undefined -- cannot assert low without a value', () => {
    expect(isLowConfidence({ quorum_reached: true })).toBe(false);
  });

  it('returns false at exactly the threshold (boundary is exclusive)', () => {
    expect(
      isLowConfidence({
        quorum_reached: true,
        confidence: LOW_CONFIDENCE_THRESHOLD,
      })
    ).toBe(false);
  });

  it('returns true just below the threshold', () => {
    expect(
      isLowConfidence({
        quorum_reached: true,
        confidence: LOW_CONFIDENCE_THRESHOLD - 0.01,
      })
    ).toBe(true);
  });

  it('returns false comfortably above the threshold', () => {
    expect(isLowConfidence({ quorum_reached: true, confidence: 0.95 })).toBe(
      false
    );
  });

  it('returns false when consensus itself is undefined', () => {
    expect(isLowConfidence(undefined)).toBe(false);
  });
});

describe('isFlaggedRecord', () => {
  it('returns false when no flag applies', () => {
    const consensus: ConsensusSubObject = {
      label: 'benign',
      confidence: 0.95,
      quorum_reached: true,
      backend_count: 2,
      votes: [
        { backend_id: 'b1', label: 'benign', score: 0.95 },
        { backend_id: 'b2', label: 'benign', score: 0.94 },
      ],
    };
    expect(isFlaggedRecord(consensus)).toBe(false);
  });

  it('returns true when only isSplit applies', () => {
    const consensus: ConsensusSubObject = {
      label: 'hostile',
      confidence: 0.95,
      quorum_reached: true,
      votes: [
        { backend_id: 'b1', label: 'hostile', score: 0.95 },
        { backend_id: 'b2', label: 'benign', score: 0.4 },
      ],
    };
    expect(isFlaggedRecord(consensus)).toBe(true);
  });

  it('returns true when only isFailOpen applies', () => {
    // quorum_reached: true here so isNoQuorum doesn't also fire -- isolates
    // the fail-open flag specifically.
    expect(isFlaggedRecord({ skipped: true, quorum_reached: true })).toBe(true);
  });

  it('returns false for undefined consensus', () => {
    expect(isFlaggedRecord(undefined)).toBe(false);
  });
});
