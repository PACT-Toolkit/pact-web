'use client';

import { useMemo, useState } from 'react';

import { useInspectBenchmarkImport } from '@/src/__codegen__/rest/benchmark';
import { type LabelDecision } from '@/src/app/benchmark/domain/benchmark_corpus_mapping';
import {
  buildImportRequest,
  buildPreviewParams,
  describeHubImportError,
  normalizeDetectedColumn,
  previewToDistinctValues,
  type HubDatasetIdentity,
  type HubImportRequestDraft,
} from '@/src/app/benchmark/domain/benchmark_import';
import { BenchmarkUploadMapping } from '@/src/app/benchmark/ui/BenchmarkUploadMapping';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';

interface BenchmarkImportCardProps {
  onSubmit: (request: HubImportRequestDraft) => Promise<void>;
  /** True only while this card's own import submission is in flight - drives
   * the "Queuing..." button copy. Kept separate from `disabled` so a
   * concurrent submission from a sibling form never makes this button claim
   * to be queuing when it isn't. */
  isSubmitting: boolean;
  /** True while a sibling form (the corpus upload form) is submitting, so
   * this card stays locked out of a second concurrent submission without
   * misreporting its own state. Only gates "Run import" - inspecting a
   * dataset doesn't touch the shared job state, so it stays available. */
  disabled: boolean;
}

export const BenchmarkImportCard = ({
  onSubmit,
  isSubmitting,
  disabled,
}: BenchmarkImportCardProps) => {
  const [slug, setSlug] = useState('');
  const [split, setSplit] = useState('');
  const [config, setConfig] = useState('');
  const [revision, setRevision] = useState('');
  const [identity, setIdentity] = useState<HubDatasetIdentity | null>(null);
  const [labelColumnOverride, setLabelColumnOverride] = useState<string | null>(
    null
  );
  const [textColumnOverride, setTextColumnOverride] = useState<string | null>(
    null
  );
  const [valueDecisionOverrides, setValueDecisionOverrides] = useState<
    Record<string, LabelDecision>
  >({});
  const [assumeLabel, setAssumeLabel] = useState<'allow' | 'block' | null>(
    null
  );

  const previewParams = useMemo(
    () => (identity ? buildPreviewParams(identity, labelColumnOverride) : null),
    [identity, labelColumnOverride]
  );

  const { data, isLoading } = useInspectBenchmarkImport(
    previewParams ?? { slug: '' },
    {
      swr: { enabled: previewParams !== null, revalidateOnFocus: false },
    }
  );

  const preview = data?.status === 200 ? data.data : undefined;
  const errorMessage =
    data && data.status !== 200
      ? describeHubImportError(data.status, data.data)
      : undefined;

  const mapping = {
    textColumn:
      textColumnOverride ??
      normalizeDetectedColumn(preview?.detected_text_column),
    labelColumn: normalizeDetectedColumn(preview?.detected_label_column),
  };

  const distinctValues = preview ? previewToDistinctValues(preview) : null;

  const valueDecisions = useMemo(
    () =>
      distinctValues?.ok
        ? { ...distinctValues.defaultDecisions, ...valueDecisionOverrides }
        : {},
    [distinctValues, valueDecisionOverrides]
  );

  const resetMappingState = () => {
    setLabelColumnOverride(null);
    setTextColumnOverride(null);
    setValueDecisionOverrides({});
    setAssumeLabel(null);
  };

  const handleInspect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim()) return;

    resetMappingState();
    setIdentity({ slug, split, config, revision });
  };

  const handleLabelColumnChange = (column: string) => {
    setLabelColumnOverride(column);
    setValueDecisionOverrides({});
    setAssumeLabel(null);
  };

  const handleValueDecisionChange = (
    value: string,
    decision: LabelDecision
  ) => {
    setValueDecisionOverrides((prev) => ({ ...prev, [value]: decision }));
  };

  const handleRun = async () => {
    if (!identity || !canRun) return;

    await onSubmit(
      buildImportRequest({
        identity,
        textColumn: mapping.textColumn,
        labelColumn: mapping.labelColumn,
        valueDecisions,
        assumeLabel,
      })
    );
  };

  const canRun =
    preview !== undefined &&
    mapping.textColumn !== null &&
    (mapping.labelColumn !== null || assumeLabel !== null);

  return (
    <Card data-testid="benchmark-import-card">
      <CardHeader>
        <CardTitle>Import from Hugging Face</CardTitle>
        <CardDescription>
          Preview a public dataset&apos;s schema and label values, map its
          columns, then queue it as a benchmark job the same way an uploaded
          corpus runs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleInspect} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="benchmark-import-slug">Dataset slug</Label>
              <Input
                id="benchmark-import-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="owner/name"
                data-testid="benchmark-import-slug"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="benchmark-import-split">
                Split <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="benchmark-import-split"
                value={split}
                onChange={(e) => setSplit(e.target.value)}
                placeholder="train"
                data-testid="benchmark-import-split"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="benchmark-import-config">
                Config <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="benchmark-import-config"
                value={config}
                onChange={(e) => setConfig(e.target.value)}
                data-testid="benchmark-import-config"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="benchmark-import-revision">
                Revision{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="benchmark-import-revision"
                value={revision}
                onChange={(e) => setRevision(e.target.value)}
                placeholder="main"
                data-testid="benchmark-import-revision"
              />
            </div>
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={!slug.trim() || isLoading}
            className="w-fit"
            data-testid="benchmark-import-inspect"
          >
            {isLoading ? 'Inspecting…' : 'Inspect'}
          </Button>
        </form>

        {errorMessage && (
          <p
            className="mt-4 text-xs text-destructive"
            data-testid="benchmark-import-inspect-error"
          >
            {errorMessage}
          </p>
        )}

        {isLoading && identity && (
          <p className="mt-4 text-sm text-muted-foreground">
            Fetching dataset schema…
          </p>
        )}

        {preview && (
          <div className="mt-4 flex flex-col gap-4">
            <p
              className="text-xs text-muted-foreground"
              data-testid="benchmark-import-preview-summary"
            >
              {preview.row_count > 0
                ? `${preview.row_count.toLocaleString()} rows in the split`
                : 'Row count unknown'}{' '}
              - sampled {preview.sampled_rows.toLocaleString()} for column
              detection.
              {preview.label_values_truncated &&
                ' Label values truncated to the first 20 seen.'}
            </p>

            <BenchmarkUploadMapping
              columns={preview.columns}
              mapping={mapping}
              onTextColumnChange={setTextColumnOverride}
              onLabelColumnChange={handleLabelColumnChange}
              distinctValues={distinctValues}
              valueDecisions={valueDecisions}
              onValueDecisionChange={handleValueDecisionChange}
            />

            {mapping.textColumn === null && (
              <p
                className="text-xs text-muted-foreground"
                data-testid="benchmark-import-text-column-hint"
              >
                No text column detected - pick the column that holds the prompt
                text before running.
              </p>
            )}

            {mapping.labelColumn === null && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="benchmark-import-assume-label">
                  No label column detected - assume every row is
                </Label>
                <Select
                  value={assumeLabel ?? ''}
                  onValueChange={(value) =>
                    setAssumeLabel(value as 'allow' | 'block')
                  }
                >
                  <SelectTrigger
                    id="benchmark-import-assume-label"
                    className="w-fit"
                    data-testid="benchmark-import-assume-label"
                  >
                    <SelectValue placeholder="Choose a label" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">Allow (benign)</SelectItem>
                    <SelectItem value="block">Block (attack)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={() => void handleRun()}
              disabled={!canRun || isSubmitting || disabled}
              className="w-fit"
              data-testid="benchmark-import-run"
            >
              {isSubmitting ? 'Queuing…' : 'Run import'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
