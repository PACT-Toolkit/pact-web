'use client';

import {
  formatCorpusRowCount,
  type BenchmarkCorpusDataset,
} from '@/src/app/benchmark/domain/benchmark_corpus_library';
import { useBenchmarkCorpusLibrary } from '@/src/app/benchmark/domain/use_benchmark_corpus_library';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

export const BenchmarkCorpusLibraryCard = () => {
  const { datasets, totalRows, isLoading, error } = useBenchmarkCorpusLibrary();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Corpus library</CardTitle>
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

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-4 py-2 font-medium">
                      Dataset
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      Category
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      License
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2 text-right font-medium tabular-nums"
                    >
                      Total rows
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2 text-right font-medium tabular-nums"
                    >
                      Block / Allow
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((dataset) => (
                    <BenchmarkCorpusDatasetRow
                      key={dataset.source_dataset}
                      dataset={dataset}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const BenchmarkCorpusDatasetRow = ({
  dataset,
}: {
  dataset: BenchmarkCorpusDataset;
}) => (
  <tr className="border-b last:border-0 hover:bg-muted/40">
    <td className="px-4 py-2 font-mono text-xs">{dataset.source_dataset}</td>
    <td className="px-4 py-2 text-muted-foreground">{dataset.category}</td>
    <td className="px-4 py-2 text-muted-foreground">{dataset.license}</td>
    <td className="px-4 py-2 text-right tabular-nums">
      {formatCorpusRowCount(dataset.total_rows)}
    </td>
    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
      {formatCorpusRowCount(dataset.block_rows)} /{' '}
      {formatCorpusRowCount(dataset.allow_rows)}
    </td>
  </tr>
);
