'use client';

import { useMemo, useRef, useState } from 'react';

import {
  computeDistinctLabelValues,
  detectDefaultColumnMapping,
  normalizeCorpus,
  type CorpusColumnMapping,
  type LabelDecision,
} from '@/src/app/benchmark/domain/benchmark_corpus_mapping';
import { parseCorpusFile } from '@/src/app/benchmark/domain/benchmark_corpus_parse';
import { BenchmarkUploadMapping } from '@/src/app/benchmark/ui/BenchmarkUploadMapping';
import { BenchmarkUploadPreview } from '@/src/app/benchmark/ui/BenchmarkUploadPreview';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Label } from '@/src/components/ui/label';

interface BenchmarkUploadFormProps {
  onSubmit: (corpusText: string) => Promise<void>;
  isSubmitting: boolean;
}

export const BenchmarkUploadForm = ({
  onSubmit,
  isSubmitting,
}: BenchmarkUploadFormProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[] | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [textColumnOverride, setTextColumnOverride] = useState<string | null>(
    null
  );
  const [labelColumnOverride, setLabelColumnOverride] = useState<string | null>(
    null
  );
  const [valueDecisionOverrides, setValueDecisionOverrides] = useState<
    Record<string, LabelDecision>
  >({});

  const defaultMapping = useMemo<CorpusColumnMapping>(
    () =>
      columns
        ? detectDefaultColumnMapping(columns)
        : { textColumn: null, labelColumn: null },
    [columns]
  );

  const mapping: CorpusColumnMapping = {
    textColumn: textColumnOverride ?? defaultMapping.textColumn,
    labelColumn: labelColumnOverride ?? defaultMapping.labelColumn,
  };

  const distinctValues = useMemo(
    () =>
      rows && mapping.labelColumn
        ? computeDistinctLabelValues(rows, mapping.labelColumn)
        : null,
    [rows, mapping.labelColumn]
  );

  const valueDecisions = useMemo(
    () =>
      distinctValues?.ok
        ? { ...distinctValues.defaultDecisions, ...valueDecisionOverrides }
        : {},
    [distinctValues, valueDecisionOverrides]
  );

  const normalized = useMemo(() => {
    if (
      !rows ||
      !columns ||
      !mapping.textColumn ||
      !mapping.labelColumn ||
      !distinctValues?.ok
    ) {
      return null;
    }

    return normalizeCorpus(
      { columns, rows },
      {
        textColumn: mapping.textColumn,
        labelColumn: mapping.labelColumn,
        valueDecisions,
      }
    );
  }, [
    rows,
    columns,
    mapping.textColumn,
    mapping.labelColumn,
    distinctValues,
    valueDecisions,
  ]);

  const resetMappingState = () => {
    setTextColumnOverride(null);
    setLabelColumnOverride(null);
    setValueDecisionOverrides({});
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);
    setColumns(null);
    setRows(null);
    resetMappingState();

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const result = parseCorpusFile(file.name, text);
      if (result.ok) {
        setColumns(result.corpus.columns);
        setRows(result.corpus.rows);
      } else {
        setParseError(result.error);
      }
    };
    reader.readAsText(file);
  };

  const handleLabelColumnChange = (column: string) => {
    setLabelColumnOverride(column);
    setValueDecisionOverrides({});
  };

  const handleValueDecisionChange = (
    value: string,
    decision: LabelDecision
  ) => {
    setValueDecisionOverrides((prev) => ({ ...prev, [value]: decision }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalized || normalized.rows.length === 0) return;
    await onSubmit(normalized.jsonl);
  };

  const canSubmit = normalized !== null && normalized.rows.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit corpus</CardTitle>
        <CardDescription>
          Upload a JSONL, JSON, or CSV file, then map its columns to a text
          field and a label field. Each mapped row is sent to the gateway and
          compared against its expected verdict.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="corpus-file">
              Corpus file (.jsonl / .json / .csv)
            </Label>
            <input
              id="corpus-file"
              ref={fileInputRef}
              type="file"
              accept=".jsonl,.ndjson,.json,.csv"
              onChange={handleFileChange}
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            {fileName && !parseError && (
              <p className="text-xs text-muted-foreground">
                {fileName} - parsed
              </p>
            )}
            {parseError && (
              <p
                className="text-xs text-destructive"
                data-testid="benchmark-upload-parse-error"
              >
                {parseError}
              </p>
            )}
          </div>

          {columns && (
            <BenchmarkUploadMapping
              columns={columns}
              mapping={mapping}
              onTextColumnChange={setTextColumnOverride}
              onLabelColumnChange={handleLabelColumnChange}
              distinctValues={distinctValues}
              valueDecisions={valueDecisions}
              onValueDecisionChange={handleValueDecisionChange}
            />
          )}

          {normalized && (
            <BenchmarkUploadPreview
              rows={normalized.rows}
              totals={normalized.totals}
            />
          )}

          <Button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="w-fit"
          >
            {isSubmitting ? 'Submitting…' : 'Run benchmark'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
