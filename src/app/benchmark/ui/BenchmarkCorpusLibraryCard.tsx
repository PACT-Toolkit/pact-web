'use client';

import { useMemo } from 'react';

import {
  countEvaluationOnlyDatasets,
  formatCorpusRowCount,
} from '@/src/app/benchmark/domain/benchmark_corpus_library';
import { corpusComposition } from '@/src/app/benchmark/domain/corpus_composition';
import { useBenchmarkCorpusLibrary } from '@/src/app/benchmark/domain/use_benchmark_corpus_library';
import { BenchmarkCorpusCompositionChart } from '@/src/app/benchmark/ui/BenchmarkCorpusCompositionChart';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

export const BenchmarkCorpusLibraryCard = () => {
  const { datasets, totalRows, isLoading, error } = useBenchmarkCorpusLibrary();
  const evaluationOnlyCount = countEvaluationOnlyDatasets(datasets);
  const compositionRows = useMemo(
    () => corpusComposition(datasets),
    [datasets]
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">Corpus library</CardTitle>
          {!isLoading && !error && evaluationOnlyCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {evaluationOnlyCount} evaluation-only
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : error ? (
          <div className="flex h-24 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <p>Couldn&apos;t load the corpus library.</p>
            <p className="text-xs">Try refreshing in a moment.</p>
          </div>
        ) : totalRows === 0 ? (
          <div className="flex h-24 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <p>No corpus data ingested yet.</p>
            <p className="text-xs">
              Run <code className="font-mono">benchmark corpus ingest</code> to
              populate the library.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-2xl font-semibold tabular-nums">
              {formatCorpusRowCount(totalRows)}{' '}
              <span className="text-sm font-normal text-muted-foreground">
                rows across {datasets.length} dataset
                {datasets.length === 1 ? '' : 's'}
              </span>
            </p>

            <BenchmarkCorpusCompositionChart rows={compositionRows} />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
