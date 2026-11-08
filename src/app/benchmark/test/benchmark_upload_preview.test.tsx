import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type OversizedCorpusRow } from '@/src/app/benchmark/domain/benchmark_corpus_mapping';
import { BenchmarkUploadPreview } from '@/src/app/benchmark/ui/BenchmarkUploadPreview';

const totals = { total: 30, attacks: 0, benign: 0, skipped: 30 };

const oversizedRows = (count: number): OversizedCorpusRow[] =>
  Array.from({ length: count }, (_, index) => ({
    label: `big-${index + 1}`,
    bytes: 70_000 + index,
  }));

describe('BenchmarkUploadPreview oversized rows', () => {
  it('lists each oversized row with its size and the reason', () => {
    render(
      <BenchmarkUploadPreview
        rows={[]}
        oversized={oversizedRows(2)}
        totals={{ ...totals, total: 2, skipped: 2 }}
      />
    );

    const items = screen.getAllByTestId(
      'benchmark-upload-preview-oversized-row'
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('big-1');
    expect(items[0]).toHaveTextContent('70,000 bytes');
    expect(
      screen.getByTestId('benchmark-upload-preview-oversized')
    ).toHaveTextContent('content over 65,536 bytes');
    expect(
      screen.queryByTestId('benchmark-upload-preview-oversized-more')
    ).toBeNull();
  });

  it('shows at most 20 rows and counts the rest', () => {
    render(
      <BenchmarkUploadPreview
        rows={[]}
        oversized={oversizedRows(27)}
        totals={totals}
      />
    );

    expect(
      screen.getAllByTestId('benchmark-upload-preview-oversized-row')
    ).toHaveLength(20);
    expect(
      screen.getByTestId('benchmark-upload-preview-oversized-more')
    ).toHaveTextContent('and 7 more');
  });

  it('renders no list when nothing is oversized', () => {
    render(<BenchmarkUploadPreview rows={[]} oversized={[]} totals={totals} />);

    expect(
      screen.queryByTestId('benchmark-upload-preview-oversized')
    ).toBeNull();
  });
});
