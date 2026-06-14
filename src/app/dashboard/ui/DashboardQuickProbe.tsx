'use client';

import { ArrowUpRight, BookmarkPlus, Play } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { checkContent } from '@/src/__codegen__/rest/check';
import { AuditDecisionInsights } from '@/src/app/audit/ui/AuditDecisionInsights';
import {
  CORPUS_ENDPOINT,
  checkResponseToDecisionPayload,
} from '@/src/app/dashboard/domain/dashboard_probe';
import { type CheckResponse } from '@/src/app/test_lab/domain/test_lab_check';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { isMock, isProduction } from '@/src/framework/helpers/environment';
import { httpClient } from '@/src/framework/http';

type ProbeStatus = 'idle' | 'running' | 'done' | 'error';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type DashboardQuickProbeProps = {
  // onProbeComplete lets the parent revalidate the shared pipeline-stats cache
  // after a probe lands, so the live stream and stage widgets reflect the new
  // decision immediately instead of waiting for the next poll.
  onProbeComplete?: () => void;
};

export const DashboardQuickProbe = ({
  onProbeComplete,
}: DashboardQuickProbeProps) => {
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<ProbeStatus>('idle');
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const runProbe = async () => {
    if (!inputText.trim()) return;
    setStatus('running');
    setResult(null);
    setSaveStatus('idle');

    try {
      const response = await checkContent({
        content: inputText,
        kind: 'input',
      });
      if (response.status !== 200) {
        throw new Error(`probe failed (${response.status})`);
      }
      setResult(response.data as CheckResponse);
      setStatus('done');
      onProbeComplete?.();
    } catch {
      setStatus('error');
    }
  };

  const saveToCorpus = async () => {
    if (!result || !inputText.trim()) return;
    setSaveStatus('saving');

    try {
      await httpClient.post(CORPUS_ENDPOINT, {
        content: inputText,
        attack_type: 'custom',
        reason: result.reason,
        filter_rule_id: result.filter_rule_id,
      });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  };

  const blocked = result?.decision === 'block';

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          Quick probe
          {!isProduction() && (
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                isMock()
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              }`}
            >
              {isMock() ? 'MOCK' : 'LIVE'}
            </span>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          Fire a prompt through the live pipeline and read the verdict without
          leaving the dashboard.
        </CardDescription>
        <Link
          href="/test-lab"
          className="col-start-2 row-start-1 flex items-center gap-0.5 self-start justify-self-end text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Test lab
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-5">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void runProbe();
          }}
          placeholder="Paste a prompt to test against filter → classifier → redactor…"
          rows={3}
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
        />

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => void runProbe()}
            disabled={!inputText.trim() || status === 'running'}
          >
            <Play className="h-3.5 w-3.5" aria-hidden />
            {status === 'running' ? 'Running…' : 'Run probe'}
          </Button>
          <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter</span>
          {status === 'error' && (
            <span className="text-xs text-destructive">
              Request failed. Is pact-gateway running?
            </span>
          )}
        </div>

        {result && (
          <div className="flex flex-col gap-2 border-t pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
                  blocked
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-green-500/10 text-green-600 dark:text-green-400'
                }`}
              >
                {result.decision.toUpperCase()}
              </span>
              {result.reason && (
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {result.reason}
                </code>
              )}
              <span className="text-xs text-muted-foreground">
                {result.latency_ms} ms
              </span>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => void saveToCorpus()}
                disabled={saveStatus === 'saving' || saveStatus === 'saved'}
              >
                <BookmarkPlus className="h-3.5 w-3.5" aria-hidden />
                {saveStatus === 'saved'
                  ? 'Saved'
                  : saveStatus === 'saving'
                    ? 'Saving…'
                    : 'Save to corpus'}
              </Button>
            </div>
            {saveStatus === 'error' && (
              <span className="text-xs text-destructive">
                Couldn&apos;t save to corpus. Try again.
              </span>
            )}
            <AuditDecisionInsights
              dp={checkResponseToDecisionPayload(result)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
