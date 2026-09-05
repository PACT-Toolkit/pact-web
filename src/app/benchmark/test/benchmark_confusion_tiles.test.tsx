import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

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
          }}
        />
      ) as ReactNode
    );

    expect(screen.getByTestId('benchmark-confusion-fn')).toHaveTextContent('0');
    expect(screen.getByTestId('benchmark-confusion-fp')).toHaveTextContent('0');
    expect(screen.getByTestId('benchmark-confusion-errors')).toHaveTextContent(
      '0'
    );
  });
});
