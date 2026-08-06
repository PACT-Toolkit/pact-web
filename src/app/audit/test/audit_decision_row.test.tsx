import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { type AuditAuditEventResponse } from '@/src/__codegen__/rest/audit';
import { AuditDecisionRow } from '@/src/app/audit/ui/AuditDecisionRow';
import { type DecisionPayload } from '@/src/lib/decisions/decision_payload';

const event = (
  payload: DecisionPayload,
  overrides: Partial<AuditAuditEventResponse> = {}
): AuditAuditEventResponse => ({
  id: 'evt-1',
  topic: 'pact.decisions',
  eventId: 'gateway.decision',
  requestId: 'req-1',
  payloadJson: JSON.stringify(payload),
  createdAt: '2026-08-01T12:00:00.000Z',
  ...overrides,
});

const renderRow = (payload: DecisionPayload) =>
  render(
    (
      <AuditDecisionRow event={event(payload)} payload={payload} />
    ) as ReactNode | null
  );

// A blocked filter decision carrying every PACT-745 field (engine,
// filter.matched_span, diagnostics.causal_spans) -- the row this feature
// exists to surface.
const SPAN_PAYLOAD: DecisionPayload = {
  decision: 'block',
  reason: 'filter_hostile',
  engine: 'filter',
  filter: {
    verdict: 'hostile',
    rule_id: 'inject-003',
    matched_span: {
      start: 12,
      end: 76,
      excerpt: 'ignore previous instructions [REDACTED:EMAIL]',
    },
  },
  diagnostics: {
    causal_spans: [
      { start: 0, end: 11 },
      { start: 76, end: 94 },
    ],
  },
  latency_ms: 4,
};

describe('AuditDecisionRow collapsed badges', () => {
  it('shows a "blocked by <engine>" badge for a blocked decision that carries engine', () => {
    renderRow(SPAN_PAYLOAD);

    expect(screen.getByText('blocked by filter')).toBeInTheDocument();
  });

  it('omits the blocked-by badge when the decision is allow, even with engine set', () => {
    renderRow({ decision: 'allow', engine: 'classifier', latency_ms: 3 });

    expect(screen.queryByText(/blocked by/i)).not.toBeInTheDocument();
  });

  it('omits the blocked-by badge on a blocked decision with no engine', () => {
    renderRow({ decision: 'block', reason: 'filter_hostile', latency_ms: 4 });

    expect(screen.queryByText(/blocked by/i)).not.toBeInTheDocument();
  });
});

describe('AuditDecisionRow collapsed stage strip (PACT-748)', () => {
  it('renders a chip per present stage, with the blocking stage distinguished, for a blocked decision with engine', () => {
    renderRow({
      decision: 'block',
      engine: 'consensus',
      classifier: { label: 'jailbreak', score: 0.58 },
      consensus: { label: 'jailbreak', confidence: 0.93, quorum_reached: true },
      latency_ms: 340,
    });

    const strip = screen.getByTestId('audit-decision-stage-strip');
    expect(strip).toHaveTextContent('Classifier');
    expect(strip).toHaveTextContent('Consensus');
  });

  it('omits the strip on an allow decision, even with per-stage data present', () => {
    renderRow({
      decision: 'allow',
      engine: 'consensus',
      classifier: { label: 'safe', score: 0.1 },
      consensus: { label: 'safe', quorum_reached: true },
      latency_ms: 12,
    });

    expect(
      screen.queryByTestId('audit-decision-stage-strip')
    ).not.toBeInTheDocument();
  });

  it('omits the strip on a blocked decision with no engine (matches the blocked-by badge gate)', () => {
    renderRow({ decision: 'block', reason: 'filter_hostile', latency_ms: 4 });

    expect(
      screen.queryByTestId('audit-decision-stage-strip')
    ).not.toBeInTheDocument();
  });

  it('renders no strip and no crash on a blocked decision that carries engine but no stage sub-objects (older events)', () => {
    renderRow({
      decision: 'block',
      reason: 'filter_hostile',
      engine: 'filter',
      latency_ms: 4,
    });

    // The row itself must still render (the blocked-by badge stays gated on
    // engine alone, independent of stage sub-object presence).
    expect(screen.getByText('blocked by filter')).toBeInTheDocument();
    expect(
      screen.queryByTestId('audit-decision-stage-strip')
    ).not.toBeInTheDocument();
  });
});

describe('AuditDecisionRow expanded detail - matched span and causal spans', () => {
  it('renders the masked excerpt verbatim and the offset range when filter.matched_span is present', () => {
    renderRow(SPAN_PAYLOAD);

    fireEvent.click(screen.getByTestId('audit-row-toggle'));

    // Verbatim, including the mask token -- no client-side truncation or
    // cleanup that could hide the masking.
    expect(
      screen.getByText('ignore previous instructions [REDACTED:EMAIL]')
    ).toBeInTheDocument();
    expect(screen.getByText('chars 12-76')).toBeInTheDocument();
  });

  it('renders the matched-span excerpt even when filter.verdict is absent (fields are independently optional)', () => {
    renderRow({
      decision: 'block',
      reason: 'filter_hostile',
      engine: 'filter',
      filter: {
        matched_span: {
          start: 12,
          end: 76,
          excerpt: 'ignore previous instructions [REDACTED:EMAIL]',
        },
      },
      latency_ms: 4,
    });

    fireEvent.click(screen.getByTestId('audit-row-toggle'));

    expect(
      screen.getByText('ignore previous instructions [REDACTED:EMAIL]')
    ).toBeInTheDocument();
    expect(screen.getByText('chars 12-76')).toBeInTheDocument();
  });

  it('lists causal span offset ranges when diagnostics.causal_spans is present', () => {
    renderRow(SPAN_PAYLOAD);

    fireEvent.click(screen.getByTestId('audit-row-toggle'));

    const causalSpans = screen.getByTestId('audit-decision-causal-spans');
    expect(causalSpans).toHaveTextContent('chars 0-11');
    expect(causalSpans).toHaveTextContent('chars 76-94');
  });

  it('renders byte-identically to a plain row when matched_span and causal_spans are absent', () => {
    renderRow({
      decision: 'block',
      reason: 'filter_hostile',
      engine: 'filter',
      filter: { verdict: 'hostile', rule_id: 'inject-003' },
      latency_ms: 4,
    });

    fireEvent.click(screen.getByTestId('audit-row-toggle'));

    expect(
      screen.queryByTestId('audit-decision-matched-span')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('audit-decision-causal-spans')
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^chars /)).not.toBeInTheDocument();
  });
});

// PACT-749: engine=cel (a PACT-335 tier-3 CEL rule escalation) and
// engine=policy have no visualised-stage mapping (see
// decision_stage_attribution.ts's STAGE_ATTRIBUTED_ENGINES), unlike
// engine=filter above. Their causal spans must still render -- just with an
// honest qualifier instead of a fabricated stage attribution.
describe('AuditDecisionRow expanded detail - unattributed causal spans', () => {
  it('renders causal spans plus a "not attributed to a stage" qualifier for a cel_rule_fired block', () => {
    renderRow({
      decision: 'block',
      reason: 'cel_rule_fired',
      engine: 'cel',
      cel: {
        rule_id: 'cel-tool-002',
        rule_name: 'disallow tool chaining past budget',
        outcome: 'block',
        fired_count: 1,
      },
      diagnostics: {
        causal_spans: [{ start: 4, end: 22 }],
      },
      latency_ms: 9,
    });

    fireEvent.click(screen.getByTestId('audit-row-toggle'));

    const causalSpans = screen.getByTestId('audit-decision-causal-spans');
    expect(causalSpans).toHaveTextContent('chars 4-22');
    expect(causalSpans).toHaveTextContent('not attributed to a stage');
  });

  it('renders the qualifier for a policy_token_denied block too', () => {
    renderRow({
      decision: 'block',
      reason: 'policy_token_denied',
      engine: 'policy',
      policy: { verdict: 'denied', agent_id: 'agent-7' },
      diagnostics: {
        causal_spans: [{ start: 0, end: 9 }],
      },
      latency_ms: 3,
    });

    fireEvent.click(screen.getByTestId('audit-row-toggle'));

    const causalSpans = screen.getByTestId('audit-decision-causal-spans');
    expect(causalSpans).toHaveTextContent('chars 0-9');
    expect(causalSpans).toHaveTextContent('not attributed to a stage');
  });

  it('renders the qualifier when engine is absent entirely (pre-PACT-745 payload)', () => {
    renderRow({
      decision: 'block',
      reason: 'filter_hostile',
      diagnostics: {
        causal_spans: [{ start: 1, end: 6 }],
      },
      latency_ms: 4,
    });

    fireEvent.click(screen.getByTestId('audit-row-toggle'));

    expect(screen.getByTestId('audit-decision-causal-spans')).toHaveTextContent(
      'not attributed to a stage'
    );
  });

  it('never shows the qualifier for an attributed block (engine=filter, unchanged from before PACT-749)', () => {
    renderRow(SPAN_PAYLOAD);

    fireEvent.click(screen.getByTestId('audit-row-toggle'));

    expect(
      screen.getByTestId('audit-decision-causal-spans')
    ).not.toHaveTextContent('not attributed to a stage');
  });
});

// PACT-758: renders the CelDecision sub-object (rule_id, rule_name, outcome,
// fired_count and, when present, skipped_reason) that PACT-749 already
// exercised for its own purpose (unattributed causal spans) but never
// asserted on directly.
describe('AuditDecisionInsights - CEL section (PACT-758)', () => {
  it('renders rule_id, rule_name, outcome and fired_count for a fired rule', () => {
    renderRow({
      decision: 'block',
      reason: 'cel_rule_fired',
      engine: 'cel',
      cel: {
        rule_id: 'cel-tool-002',
        rule_name: 'disallow tool chaining past budget',
        outcome: 'block',
        fired_count: 1,
      },
      latency_ms: 9,
    });

    fireEvent.click(screen.getByTestId('audit-row-toggle'));

    const cel = screen.getByTestId('audit-decision-cel');
    expect(cel).toHaveTextContent('disallow tool chaining past budget');
    expect(cel).toHaveTextContent('cel-tool-002');
    expect(cel).toHaveTextContent('block');
    expect(cel).toHaveTextContent('1 rule fired');
  });

  it('pluralizes fired_count when more than one rule fired', () => {
    renderRow({
      decision: 'block',
      reason: 'cel_rule_fired',
      engine: 'cel',
      cel: {
        rule_id: 'cel-tool-002',
        rule_name: 'disallow tool chaining past budget',
        outcome: 'block',
        fired_count: 3,
      },
      latency_ms: 9,
    });

    fireEvent.click(screen.getByTestId('audit-row-toggle'));

    expect(screen.getByTestId('audit-decision-cel')).toHaveTextContent(
      '3 rules fired'
    );
  });

  it('renders a human skipped_reason label for a fail-open stage timeout, with no rule fields', () => {
    renderRow({
      decision: 'allow',
      cel: {
        skipped_reason: 'cel_stage_timeout',
      },
      latency_ms: 11,
    });

    fireEvent.click(screen.getByTestId('audit-row-toggle'));

    const cel = screen.getByTestId('audit-decision-cel');
    expect(cel).toHaveTextContent('skipped (stage timeout)');
    expect(cel).not.toHaveTextContent('fired');
  });

  it('renders no CEL section when the payload carries no cel object (older rows)', () => {
    renderRow(SPAN_PAYLOAD);

    fireEvent.click(screen.getByTestId('audit-row-toggle'));

    expect(screen.queryByTestId('audit-decision-cel')).not.toBeInTheDocument();
  });
});
