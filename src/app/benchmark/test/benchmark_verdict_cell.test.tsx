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
});
