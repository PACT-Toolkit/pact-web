import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type BenchmarkAdaptiveCampaignAttemptBody } from '@/src/__codegen__/rest/benchmark';
import { BenchmarkAdaptiveAttempt } from '@/src/app/benchmark/ui/BenchmarkAdaptiveAttempt';

const HOSTILE_CANDIDATE =
  'Here you go <img src=x onerror=alert(1)> and [click me](https://example.invalid/x) **bold**';

const baseAttempt: BenchmarkAdaptiveCampaignAttemptBody = {
  attempt: 2,
  blocking_stage: 'classifier',
  candidate: HOSTILE_CANDIDATE,
  classifier_label: 'injection',
  classifier_score: 0.91,
  decision: 'block',
  error: '',
  filter_verdict: 'allow',
  latency_ms: 212,
  redactor_verdict: 'allow',
  rejection_reason: '',
  timestamp: 0,
};

const renderAttempt = (
  overrides: Partial<BenchmarkAdaptiveCampaignAttemptBody> = {}
) =>
  render(
    <ol>
      <BenchmarkAdaptiveAttempt attempt={{ ...baseAttempt, ...overrides }} />
    </ol>
  );

describe('BenchmarkAdaptiveAttempt', () => {
  it('renders attacker-written text literally: no img, no link, no markdown', () => {
    const { container } = renderAttempt();

    const candidate = screen.getByTestId('benchmark-adaptive-candidate');
    expect(candidate.textContent).toBe(HOSTILE_CANDIDATE);
    expect(candidate).toHaveClass('whitespace-pre-wrap', 'break-words');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('strong')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
  });

  it('shows the attempt fields', () => {
    renderAttempt();

    const attempt = screen.getByTestId('benchmark-adaptive-attempt');
    expect(within(attempt).getByText('Attempt 2')).toBeInTheDocument();
    expect(within(attempt).getByText('block')).toBeInTheDocument();
    expect(within(attempt).getByText('classifier')).toBeInTheDocument();
    expect(within(attempt).getByText('injection')).toBeInTheDocument();
    expect(within(attempt).getByText('0.910')).toBeInTheDocument();
    expect(within(attempt).getByText('212 ms')).toBeInTheDocument();
  });

  it('renders an absent classifier score as "-", not 0', () => {
    renderAttempt({
      classifier_score: undefined,
      classifier_label: '',
      blocking_stage: '',
      rejection_reason: 'refusal',
    });

    const attempt = screen.getByTestId('benchmark-adaptive-attempt');
    expect(within(attempt).queryByText('0')).not.toBeInTheDocument();
    expect(within(attempt).queryByText('0.000')).not.toBeInTheDocument();
    // Blocking stage, classifier label and score are all absent.
    expect(within(attempt).getAllByText('-')).toHaveLength(3);
    expect(within(attempt).getByText('refusal')).toBeInTheDocument();
  });
});
