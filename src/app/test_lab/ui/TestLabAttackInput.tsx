'use client';

import { Play, Upload } from 'lucide-react';
import { useRef } from 'react';

import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { isMock, isProduction } from '@/src/framework/helpers/environment';

import { type AttackChip, type RunStatus } from './types';

export const TestLabAttackInput = ({
  inputText,
  onInputChange,
  attackType,
  chips,
  chipsError = false,
  onChipSelect,
  status,
  onRun,
  onFileSelect,
}: {
  inputText: string;
  onInputChange: (text: string) => void;
  attackType: string;
  chips: AttackChip[];
  chipsError?: boolean;
  onChipSelect: (id: string, example: string) => void;
  status: RunStatus;
  onRun: () => void;
  onFileSelect: (text: string, type: string) => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text().catch(() => `[binary: ${file.name}]`);
    onFileSelect(text.slice(0, 4000), 'indirect');
    e.target.value = '';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Attack Input</CardTitle>
        <CardDescription>
          Paste a prompt or upload a file to run it through the filter pipeline.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {chips.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChipSelect(t.id, t.example)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                attackType === t.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {chipsError && (
          <p role="alert" className="text-xs text-destructive">
            Could not load attack examples.
          </p>
        )}

        <textarea
          data-testid="test-lab-attack-input"
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Enter a prompt to test against the filter pipeline…"
          rows={4}
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => void handleFileUpload(e)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Attach file
          </Button>
          <Button
            size="sm"
            onClick={onRun}
            disabled={!inputText.trim() || status === 'running'}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            {status === 'running' ? 'Running…' : 'Run Test'}
          </Button>
          {!isProduction() && (
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
                isMock()
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              }`}
            >
              {isMock() ? 'MOCK' : 'LIVE'}
            </span>
          )}
          {status === 'error' && (
            <span className="text-xs text-destructive">
              {isMock()
                ? 'Mock handler failed'
                : 'Request failed - is pact-gateway running?'}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
