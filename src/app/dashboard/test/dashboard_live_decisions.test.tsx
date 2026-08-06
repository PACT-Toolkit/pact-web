import { fireEvent, render, screen, within } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { type DecisionRecord } from '@/src/app/dashboard/domain/dashboard_pipeline_stats';
import { DashboardLiveDecisions } from '@/src/app/dashboard/ui/DashboardLiveDecisions';
import { type DecisionPayload } from '@/src/lib/decisions/decision_payload';

let seq = 0;

const record = (dp: DecisionPayload): DecisionRecord => {
  seq += 1;
  const requestId = `req-live-${seq}`;

  return {
    event: {
      id: `evt-${seq}`,
      topic: 'pact.decisions',
      eventId: 'gateway.decision',
      requestId,
      payloadJson: JSON.stringify(dp),
      createdAt: '2026-08-01T12:00:00.000Z',
    },
    dp,
  };
};

// Two client-app decisions (one blocked), one Test Lab block, one benchmark
// allow - enough to give every rendered tab a distinct count.
const RECORDS: DecisionRecord[] = [
  record({ decision: 'allow' }),
  // The classifier labels double as row identity in assertions below - the
  // collapsed AuditDecisionRow renders classifier.label as a badge (unlike
  // filter.rule_id, which sits behind the expand toggle).
  record({
    decision: 'block',
    reason: 'filter_hostile',
    filter: { verdict: 'hostile', rule_id: 'inject-003' },
    classifier: { label: 'client-inject' },
  }),
  record({
    decision: 'block',
    reason: 'filter_hostile',
    filter: { verdict: 'hostile', rule_id: 'role-001' },
    classifier: { label: 'lab-inject' },
    traffic_source: 'test_lab',
  }),
  record({ decision: 'allow', traffic_source: 'benchmark' }),
];

const renderStream = (records: DecisionRecord[] = RECORDS) =>
  render(
    (
      <DashboardLiveDecisions
        records={records}
        live={false}
        onToggleLive={() => {}}
        onRefresh={() => {}}
      />
    ) as ReactNode
  );

// The source strip is a filter group of aria-pressed buttons (deliberately
// not ARIA tabs -- see the component comment), sharing button names like
// "All N" with the severity chips, so every query scopes through the group.
const sourceStrip = () =>
  screen.getByRole('group', { name: 'Decision source' });
const severityChips = () => screen.getByRole('group', { name: 'Severity' });

describe('DashboardLiveDecisions source tabs', () => {
  it('renders one tab per populated source with its count, client-first', () => {
    renderStream();

    const tabs = within(sourceStrip()).getAllByRole('button');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'All4',
      'Client app2',
      'Test Lab1',
      'Benchmark1',
    ]);
  });

  it('always renders Client app and Test Lab, but hides an empty Benchmark tab', () => {
    renderStream([record({ decision: 'allow' })]);

    const tabs = within(sourceStrip()).getAllByRole('button');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'All1',
      'Client app1',
      'Test Lab0',
    ]);
  });

  it('filters the stream to the selected source', () => {
    renderStream();

    fireEvent.click(
      within(sourceStrip()).getByRole('button', { name: /test lab/i })
    );

    // Only the Test Lab block remains: its classifier badge is visible, the
    // client-only row's is not.
    expect(screen.getByText('lab-inject')).toBeInTheDocument();
    expect(screen.queryByText('client-inject')).not.toBeInTheDocument();
  });

  it('scopes the severity chip counts to the selected source tab', () => {
    renderStream();

    // Whole window first: 4 decisions, 2 blocked.
    expect(
      within(severityChips()).getByRole('button', { name: 'All 4' })
    ).toBeInTheDocument();
    expect(
      within(severityChips()).getByRole('button', { name: 'Blocked 2' })
    ).toBeInTheDocument();

    fireEvent.click(
      within(sourceStrip()).getByRole('button', { name: /client app/i })
    );

    // Client app only: 2 decisions, 1 blocked - the chips describe the
    // filtered list, not the whole window.
    expect(
      within(severityChips()).getByRole('button', { name: 'All 2' })
    ).toBeInTheDocument();
    expect(
      within(severityChips()).getByRole('button', { name: 'Blocked 1' })
    ).toBeInTheDocument();
  });

  it('composes source tab and severity chip filters', () => {
    renderStream();

    fireEvent.click(
      within(sourceStrip()).getByRole('button', { name: /client app/i })
    );
    fireEvent.click(
      within(severityChips()).getByRole('button', { name: 'Blocked 1' })
    );

    expect(screen.getByText('client-inject')).toBeInTheDocument();
    expect(screen.queryByText('lab-inject')).not.toBeInTheDocument();
  });

  it('shows a Test Lab-specific empty state when the tab has no events', () => {
    renderStream([record({ decision: 'allow' })]);

    fireEvent.click(
      within(sourceStrip()).getByRole('button', { name: /test lab/i })
    );

    expect(
      screen.getByText(/no test lab decisions in the window/i)
    ).toBeInTheDocument();
  });
});
