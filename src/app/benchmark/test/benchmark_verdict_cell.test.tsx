import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BenchmarkVerdictCell } from '@/src/app/benchmark/ui/BenchmarkVerdictCell';

describe('BenchmarkVerdictCell', () => {
  it('shows the decision as a verdict chip for an ordinary row', () => {
    render(<BenchmarkVerdictCell row={{ decision: 'block' }} />);

    expect(screen.getByText('block')).toBeVisible();
  });

  it('shows an error marker instead of the decision', () => {
    render(<BenchmarkVerdictCell row={{ decision: 'allow', error: 'boom' }} />);

    expect(screen.getByText('error')).toBeVisible();
    expect(screen.queryByText('allow')).not.toBeInTheDocument();
  });

  it('shows a throttled marker with an explanation instead of the decision', () => {
    render(
      <BenchmarkVerdictCell row={{ decision: 'allow', throttled: true }} />
    );

    expect(screen.getByText('throttled')).toHaveAttribute(
      'title',
      expect.stringContaining('throttled')
    );
    expect(screen.queryByText('allow')).not.toBeInTheDocument();
  });

  it('shows an unscored marker instead of the fail-open allow', () => {
    render(
      <BenchmarkVerdictCell row={{ decision: 'allow', unscored: true }} />
    );

    expect(screen.getByText('unscored')).toBeVisible();
    expect(screen.queryByText('allow')).not.toBeInTheDocument();
  });

  it('never shows a throttled and unscored row as a verdict', () => {
    render(
      <BenchmarkVerdictCell
        row={{ decision: 'allow', throttled: true, unscored: true }}
      />
    );

    expect(screen.getByText('throttled')).toBeVisible();
    expect(screen.queryByText('unscored')).not.toBeInTheDocument();
  });

  it('badges a redactor-redacted row as mitigated with a content-redacted tooltip, keeping its verdict', () => {
    render(
      <BenchmarkVerdictCell row={{ decision: 'allow', redacted: true }} />
    );

    expect(screen.getByText('allow')).toBeVisible();
    const badge = screen.getByTestId('benchmark-row-mitigated-badge');
    expect(badge).toHaveTextContent('mitigated');
    expect(badge).toHaveAttribute('title', 'content redacted');
  });

  it('badges a classifier-mitigated row that is not redacted with a classifier tooltip', () => {
    render(
      <BenchmarkVerdictCell
        row={{
          decision: 'allow',
          redacted: false,
          reason: 'classifier_mitigated',
        }}
      />
    );

    expect(screen.getByTestId('benchmark-row-mitigated-badge')).toHaveAttribute(
      'title',
      'classifier mitigation'
    );
  });

  it('shows no badge on a blocked, plain-allow or blocked-but-redacted row', () => {
    for (const row of [
      { decision: 'block' },
      { decision: 'allow' },
      { decision: 'block', redacted: true },
    ]) {
      const { unmount } = render(<BenchmarkVerdictCell row={row} />);

      expect(
        screen.queryByTestId('benchmark-row-mitigated-badge')
      ).not.toBeInTheDocument();
      unmount();
    }
  });
});

describe('BenchmarkVerdictCell attempts marker', () => {
  it('shows a muted marker with the request count for a retried row', () => {
    render(<BenchmarkVerdictCell row={{ decision: 'block', attempts: 3 }} />);

    const marker = screen.getByTestId('benchmark-row-attempts');
    expect(marker).toHaveTextContent('×3');
    expect(marker).toHaveAttribute(
      'title',
      'needed 3 requests (requeued 2 times)'
    );
    expect(marker).toHaveClass('text-muted-foreground');
  });

  it('shows no marker when the row needed one request or none was recorded', () => {
    for (const attempts of [undefined, 0, 1]) {
      const { unmount } = render(
        <BenchmarkVerdictCell row={{ decision: 'block', attempts }} />
      );

      expect(
        screen.queryByTestId('benchmark-row-attempts')
      ).not.toBeInTheDocument();
      unmount();
    }
  });

  it('keeps the marker off an errored, throttled or unscored row', () => {
    for (const row of [
      { error: 'boom', attempts: 4 },
      { throttled: true, attempts: 4 },
      { unscored: true, attempts: 4 },
    ]) {
      const { unmount } = render(<BenchmarkVerdictCell row={row} />);

      expect(
        screen.queryByTestId('benchmark-row-attempts')
      ).not.toBeInTheDocument();
      unmount();
    }
  });
});
