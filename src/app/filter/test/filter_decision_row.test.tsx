import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { type AuditAuditEventResponse } from '@/src/__codegen__/rest/audit';
import { FilterDecisionRow } from '@/src/app/filter/ui/FilterDecisionRow';

// A blocked decision -- FilterDecisionRow only renders the flag control
// (and any flag-failure banner) for blocked decisions.
const blockedEvent: AuditAuditEventResponse = {
  id: 'evt-1',
  requestId: 'req-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  payloadJson: JSON.stringify({
    request_id: 'req-1',
    decision: 'block',
  }),
};

describe('FilterDecisionRow flag-failure banner (PACT-835)', () => {
  it('renders "Flag failed." for a failed flag attempt even when isFlagged is true', () => {
    // Reproduces the PACT-835 review finding: a flag click whose annotation
    // write succeeded but whose classifier label write failed leaves
    // isFlagged=true post-rollback/revalidate, while the operator's
    // attempted action was still "flag". The banner must reflect the
    // attempted action (flagFailure prop), not the resulting isFlagged
    // state.
    render(
      (
        <FilterDecisionRow
          event={blockedEvent}
          isFlagged
          isFlagging={false}
          flagFailure="flag"
          onToggleFlagFP={vi.fn()}
        />
      ) as ReactNode
    );

    expect(screen.getByText('Flag failed. Try again.')).toBeInTheDocument();
    expect(
      screen.queryByText('Unflag failed. Try again.')
    ).not.toBeInTheDocument();
  });

  it('renders "Unflag failed." for a failed unflag attempt', () => {
    render(
      (
        <FilterDecisionRow
          event={blockedEvent}
          isFlagged
          isFlagging={false}
          flagFailure="unflag"
          onToggleFlagFP={vi.fn()}
        />
      ) as ReactNode
    );

    expect(screen.getByText('Unflag failed. Try again.')).toBeInTheDocument();
    expect(
      screen.queryByText('Flag failed. Try again.')
    ).not.toBeInTheDocument();
  });

  it('renders no banner when flagFailure is undefined', () => {
    render(
      (
        <FilterDecisionRow
          event={blockedEvent}
          isFlagged={false}
          isFlagging={false}
          onToggleFlagFP={vi.fn()}
        />
      ) as ReactNode
    );

    expect(
      screen.queryByText('Flag failed. Try again.')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Unflag failed. Try again.')
    ).not.toBeInTheDocument();
  });
});
