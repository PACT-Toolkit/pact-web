import {
  truncateForPreview,
  type CorpusTotals,
  type NormalizedCorpusRow,
} from '@/src/app/benchmark/domain/benchmark_corpus_mapping';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table';
import { StatTile } from '@/src/framework/components/stat_tile';

const PREVIEW_ROW_COUNT = 5;

interface BenchmarkUploadPreviewProps {
  rows: NormalizedCorpusRow[];
  totals: CorpusTotals;
}

export const BenchmarkUploadPreview = ({
  rows,
  totals,
}: BenchmarkUploadPreviewProps) => (
  <div className="flex flex-col gap-4" data-testid="benchmark-upload-preview">
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatTile
        label="Rows"
        value={totals.total}
        size="sm"
        testId="benchmark-upload-preview-total"
      />
      <StatTile
        label="Attacks"
        value={totals.attacks}
        size="sm"
        testId="benchmark-upload-preview-attacks"
      />
      <StatTile
        label="Benign"
        value={totals.benign}
        size="sm"
        testId="benchmark-upload-preview-benign"
      />
      <StatTile
        label="Skipped"
        value={totals.skipped}
        size="sm"
        testId="benchmark-upload-preview-skipped"
      />
    </div>

    {rows.length > 0 && (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Content</TableHead>
            <TableHead>Expected label</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, PREVIEW_ROW_COUNT).map((row, index) => (
            <TableRow key={index} data-testid="benchmark-upload-preview-row">
              <TableCell className="font-mono text-xs">{row.id}</TableCell>
              <TableCell className="max-w-md truncate" title={row.content}>
                {truncateForPreview(row.content)}
              </TableCell>
              <TableCell>{row.expected_label}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )}
  </div>
);
