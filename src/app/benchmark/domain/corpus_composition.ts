import {
  benchmarkCorpusDatasetRole,
  type BenchmarkCorpusDataset,
  type BenchmarkCorpusDatasetRole,
} from '@/src/app/benchmark/domain/benchmark_corpus_library';

/** One row on the corpus composition chart: a dataset's block/allow split as a 100%-stacked bar. */
export interface CorpusCompositionRow {
  source_dataset: string;
  category: string;
  license: string;
  role: BenchmarkCorpusDatasetRole;
  total_rows: number;
  block_rows: number;
  allow_rows: number;
  /** Block share of the row, 0-100 rounded to one decimal. 0 when the dataset has no rows. */
  blockPercent: number;
  /**
   * Allow share of the row, 0-100. Derived as `100 - blockPercent` rather than
   * rounded independently, so the two segments of the stacked bar always sum
   * to exactly 100 (independent rounding can drift to 99.9 or 100.1).
   */
  allowPercent: number;
}

function roundToOneDecimalPercent(fraction: number): number {
  return Math.round(fraction * 1000) / 10;
}

/**
 * Map corpus library dataset summaries into 100%-stacked composition rows.
 * Datasets are returned in the order given - the gateway already sorts them
 * by total_rows descending (see use_benchmark_corpus_library.ts's "do not
 * re-sort" comment), so this does not re-sort either.
 *
 * The stacked split is computed from `block_rows + allow_rows` rather than
 * `total_rows`: they are expected to match under the current contract, but
 * stacking against their own sum guarantees the bar always fills exactly
 * 100% even if a future row's total_rows ever disagrees.
 */
export function corpusComposition(
  datasets: readonly BenchmarkCorpusDataset[]
): CorpusCompositionRow[] {
  return datasets.map((dataset) => {
    const splitTotal = dataset.block_rows + dataset.allow_rows;
    const blockPercent =
      splitTotal === 0
        ? 0
        : roundToOneDecimalPercent(dataset.block_rows / splitTotal);
    const allowPercent = splitTotal === 0 ? 0 : 100 - blockPercent;

    return {
      source_dataset: dataset.source_dataset,
      category: dataset.category,
      license: dataset.license,
      role: benchmarkCorpusDatasetRole(dataset),
      total_rows: dataset.total_rows,
      block_rows: dataset.block_rows,
      allow_rows: dataset.allow_rows,
      blockPercent,
      allowPercent,
    };
  });
}
