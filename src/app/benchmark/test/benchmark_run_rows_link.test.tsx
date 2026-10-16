import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { BenchmarkRunRowsLink } from '@/src/app/benchmark/ui/BenchmarkRunRowsLink';

describe('BenchmarkRunRowsLink', () => {
  it('links to the encoded rows view of the persisted run', () => {
    render((<BenchmarkRunRowsLink runId="run/1 a" />) as ReactNode);

    expect(screen.getByRole('link', { name: 'View rows' })).toHaveAttribute(
      'href',
      '/benchmark/runs/run%2F1%20a'
    );
  });

  it('renders nothing when the job has no run id', () => {
    const { container } = render(
      (<BenchmarkRunRowsLink runId={undefined} />) as ReactNode
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the run id is an empty string', () => {
    const { container } = render(
      (<BenchmarkRunRowsLink runId="" />) as ReactNode
    );

    expect(container).toBeEmptyDOMElement();
  });
});
