'use client';

import { useRef, useState } from 'react';

import { validateCorpusFile } from '@/src/app/benchmark/domain/benchmark_job';
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

interface BenchmarkUploadFormProps {
  onSubmit: (corpusText: string, gatewayVersion: string) => Promise<void>;
  isSubmitting: boolean;
}

export const BenchmarkUploadForm = ({
  onSubmit,
  isSubmitting,
}: BenchmarkUploadFormProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [corpusText, setCorpusText] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [gatewayVersion, setGatewayVersion] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setValidationError(null);
    setCorpusText(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const error = validateCorpusFile(file.name, text);
      if (error) {
        setValidationError(error);
      } else {
        setCorpusText(text);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!corpusText) return;
    await onSubmit(corpusText, gatewayVersion);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit corpus</CardTitle>
        <CardDescription>
          Upload a JSONL or CSV file with{' '}
          <code className="rounded bg-muted px-1 text-xs">content</code> and{' '}
          <code className="rounded bg-muted px-1 text-xs">expected_label</code>{' '}
          columns. Each row is sent to the gateway and compared against its
          expected verdict.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="corpus-file">Corpus file (.jsonl / .csv)</Label>
            <input
              id="corpus-file"
              ref={fileInputRef}
              type="file"
              accept=".jsonl,.ndjson,.csv"
              onChange={handleFileChange}
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            {fileName && !validationError && (
              <p className="text-xs text-muted-foreground">
                {fileName} — ready to submit
              </p>
            )}
            {validationError && (
              <p className="text-xs text-destructive">{validationError}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="gateway-version">Gateway version (optional)</Label>
            <Input
              id="gateway-version"
              placeholder="e.g. v1.4.2"
              value={gatewayVersion}
              onChange={(e) => setGatewayVersion(e.target.value)}
              className="max-w-xs"
            />
          </div>

          <Button
            type="submit"
            disabled={!corpusText || isSubmitting}
            className="w-fit"
          >
            {isSubmitting ? 'Submitting…' : 'Run benchmark'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
