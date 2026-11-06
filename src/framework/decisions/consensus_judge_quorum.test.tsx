import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  ConsensusJudgeQuorum,
  judgeCountLabel,
} from '@/src/framework/decisions/consensus_judge_quorum';

describe('judgeCountLabel', () => {
  it('reads "N of M judges" when configured_count is present', () => {
    expect(judgeCountLabel({ backend_count: 2, configured_count: 3 })).toBe(
      '2 of 3 judges'
    );
  });

  it('falls back to the responder count without inventing an M', () => {
    expect(judgeCountLabel({ backend_count: 3 })).toBe('3 backends');
    expect(judgeCountLabel({ backend_count: 1 })).toBe('1 backend');
    expect(judgeCountLabel({})).toBeUndefined();
  });
});

describe('ConsensusJudgeQuorum', () => {
  it('shows the partial-quorum marker only when full_quorum is false', () => {
    const { rerender } = render(
      <ConsensusJudgeQuorum
        consensus={{
          backend_count: 2,
          configured_count: 3,
          full_quorum: false,
        }}
      />
    );

    expect(screen.getByTestId('consensus-judge-count')).toHaveTextContent(
      '2 of 3 judges'
    );
    expect(screen.getByTestId('consensus-partial-quorum')).toHaveTextContent(
      'Partial quorum'
    );

    rerender(
      <ConsensusJudgeQuorum
        consensus={{
          backend_count: 3,
          configured_count: 3,
          full_quorum: true,
        }}
      />
    );
    expect(
      screen.queryByTestId('consensus-partial-quorum')
    ).not.toBeInTheDocument();
  });

  it('treats an absent full_quorum (older rows) as unknown, not partial', () => {
    render(<ConsensusJudgeQuorum consensus={{ backend_count: 3 }} />);

    expect(screen.getByTestId('consensus-judge-count')).toHaveTextContent(
      '3 backends'
    );
    expect(
      screen.queryByTestId('consensus-partial-quorum')
    ).not.toBeInTheDocument();
  });
});
