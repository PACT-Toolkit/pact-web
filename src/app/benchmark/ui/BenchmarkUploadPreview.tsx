import {
  truncateForPreview,
  type CorpusTotals,
  CONTENT_MAX_BYTES,
  type NormalizedCorpusRow,
  type OversizedCorpusRow,
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
const OVERSIZED_LIST_LIMIT = 20;

interface BenchmarkUploadPreviewProps {
  rows: NormalizedCorpusRow[];
  oversized: OversizedCorpusRow[];
  totals: CorpusTotals;
}

export const BenchmarkUploadPreview = ({
  rows,
  oversized,
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

    {oversized.length > 0 && (
      <div
        className="flex flex-col gap-1 text-sm"
        data-testid="benchmark-upload-preview-oversized"
      >
        <p className="font-medium">
          Skipped: content over {CONTENT_MAX_BYTES.toLocaleString('en-US')}{' '}
          bytes
        </p>
        <ul className="flex flex-col gap-1 text-muted-foreground">
          {oversized.slice(0, OVERSIZED_LIST_LIMIT).map((row, index) => (
            <li
              key={index}
              className="break-words"
              data-testid="benchmark-upload-preview-oversized-row"
            >
              <span className="font-mono text-xs break-all">{row.label}</span>
              {' - '}
              {row.bytes.toLocaleString('en-US')} bytes, over the limit
            </li>
          ))}
          {oversized.length > OVERSIZED_LIST_LIMIT && (
            <li data-testid="benchmark-upload-preview-oversized-more">
              and {oversized.length - OVERSIZED_LIST_LIMIT} more
            </li>
          )}
        </ul>
      </div>
    )}

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
