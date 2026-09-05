import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { type RunCounts } from '@/src/app/benchmark/domain/benchmark_breakdown';
import { BenchmarkConfusionTiles } from '@/src/app/benchmark/ui/BenchmarkConfusionTiles';

describe('BenchmarkConfusionTiles', () => {
  it('renders nothing when the job has no counts breakdown', () => {
    const { container } = render(
      (<BenchmarkConfusionTiles counts={undefined} />) as ReactNode
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('derives and renders the confusion matrix from counts', () => {
    render(
      (
        <BenchmarkConfusionTiles
          counts={{
            attacks: 100,
            benign: 100,
            errors: 2,
            false_positives: 4,
            true_positives: 93,
            throttled: 0,
          }}
        />
      ) as ReactNode
    );

    expect(screen.getByTestId('benchmark-confusion-tp')).toHaveTextContent(
      '93'
    );
    // False negatives = attacks - true_positives = 100 - 93 = 7.
    expect(screen.getByTestId('benchmark-confusion-fn')).toHaveTextContent('7');
    expect(screen.getByTestId('benchmark-confusion-fp')).toHaveTextContent('4');
    // True negatives = benign - false_positives = 100 - 4 = 96.
    expect(screen.getByTestId('benchmark-confusion-tn')).toHaveTextContent(
      '96'
    );
    expect(screen.getByTestId('benchmark-confusion-errors')).toHaveTextContent(
      '2'
    );
    expect(
      screen.getByTestId('benchmark-confusion-throttled')
    ).toHaveTextContent('0');
  });

  it('shows a zero-error confusion matrix without any destructive styling assumptions', () => {
    render(
      (
        <BenchmarkConfusionTiles
          counts={{
            attacks: 50,
            benign: 50,
            errors: 0,
            false_positives: 0,
            true_positives: 50,
            throttled: 0,
          }}
        />
      ) as ReactNode
    );

    expect(screen.getByTestId('benchmark-confusion-fn')).toHaveTextContent('0');
    expect(screen.getByTestId('benchmark-confusion-fp')).toHaveTextContent('0');
    expect(screen.getByTestId('benchmark-confusion-errors')).toHaveTextContent(
      '0'
    );
    expect(screen.getByTestId('benchmark-confusion-throttled')).not.toHaveClass(
      'text-warning'
    );
  });

  it('shows throttled rows with a warning tone and their rate, not destructive', () => {
    render(
      (
        <BenchmarkConfusionTiles
          counts={{
            attacks: 90,
            benign: 90,
            errors: 0,
            false_positives: 0,
            true_positives: 90,
            throttled: 20,
          }}
        />
      ) as ReactNode
    );

    // total rows = 90 + 90 + 0 + 20 = 200, throttledRate = 20 / 200 = 10%.
    const tile = screen.getByTestId('benchmark-confusion-throttled');
    expect(tile).toHaveTextContent('20');
    expect(tile).toHaveTextContent('10.0%');
    expect(tile.querySelector('[data-slot="stat-tile-value"]')).toHaveClass(
      'text-warning'
    );
    expect(tile.querySelector('[data-slot="stat-tile-value"]')).not.toHaveClass(
      'text-destructive'
    );
  });

  it('handles a counts object missing throttled entirely (pre-PACT-933 run)', () => {
    render(
      (
        <BenchmarkConfusionTiles
          counts={
            {
              attacks: 50,
              benign: 50,
              errors: 0,
              false_positives: 0,
              true_positives: 50,
            } as unknown as RunCounts
          }
        />
      ) as ReactNode
    );

    expect(
      screen.getByTestId('benchmark-confusion-throttled')
    ).toHaveTextContent('0');
  });
});
