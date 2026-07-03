'use client';

import { BrainCircuit, Flag, Play } from 'lucide-react';
import { useState } from 'react';

import { useCheckContent } from '@/src/__codegen__/rest/check';
import { useLabelVerdict } from '@/src/__codegen__/rest/classifier';
import {
  availableLabelAction,
  buildLabelVerdictRequest,
  type OperatorLabelAction,
} from '@/src/app/classifier/domain/classifier_label';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

// Ad-hoc classifier test-and-label panel (PACT-322 part 2): paste text, run
// it through the real pipeline via /v1/check with kind "input" (prompt
// injection/jailbreak is a property of what the caller sends the model, the
// direction the classifier stage is most commonly exercised against --
// mirrors RedactorTestPanel's "output" choice for the redactor stage), and
// render the classifier verdict the gateway reported.
//
// Part 1 (PR #118) shipped the live /classifier verdict console but
// deliberately left the FP/FN label action out: pact.decisions events only
// ever carry content.sha256/bytes, never raw text, while gateway's
// POST /v1/classifier/label hard-requires non-empty content at runtime.
// This panel is the follow-up entry point -- content is in-hand here
// because the operator just typed it, so the label action becomes
// possible. Labeling historical/passive console rows remains out of scope
// by design.
//
// Uses the generated useCheckContent SWR-mutation hook for the check
// (same contract RedactorTestPanel/Test Lab/DashboardQuickProbe already
// share) and the generated useLabelVerdict SWR-mutation hook for the label
// action (src/__codegen__/rest/classifier, regenerated from pact-gateway's
// api/swagger/classifier.yaml for this PR).
export const ClassifierTestPanel = () => {
  const [content, setContent] = useState('');
  const { trigger: runCheck, data, error, isMutating } = useCheckContent();
  const { trigger: submitLabel, isMutating: isLabeling } = useLabelVerdict();
  const [labeledAction, setLabeledAction] =
    useState<OperatorLabelAction | null>(null);
  const [labelErrorMessage, setLabelErrorMessage] = useState<string | null>(
    null
  );

  const result = data?.status === 200 ? data.data : undefined;
  const requestFailed =
    Boolean(error) || (data !== undefined && data.status !== 200);
  const classifier = result?.classifier;

  const runTest = () => {
    if (!content.trim()) return;
    setLabeledAction(null);
    setLabelErrorMessage(null);
    void runCheck({ content, kind: 'input' });
  };

  const handleLabel = async (action: OperatorLabelAction) => {
    if (!result?.request_id || !classifier?.label) return;

    setLabelErrorMessage(null);
    try {
      const response = await submitLabel(
        buildLabelVerdictRequest({
          requestId: result.request_id,
          content,
          predictedLabel: classifier.label,
          predictedConfidence: classifier.score,
          operatorLabel: action,
        })
      );

      if (response.status === 200) {
        setLabeledAction(action);
      } else {
        setLabelErrorMessage('Label request failed. Is pact-gateway running?');
      }
    } catch {
      setLabelErrorMessage('Label request failed. Is pact-gateway running?');
    }
  };

  const action = classifier?.label
    ? availableLabelAction(classifier.label)
    : undefined;
  const canLabel = Boolean(result?.request_id && classifier?.label);
  const labelButtonsDisabled =
    !canLabel || isLabeling || labeledAction !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4" aria-hidden />
          Ad-hoc classifier test
        </CardTitle>
        <CardDescription>
          Paste text and run it through the classifier stage via /v1/check
          (kind: input). Once a verdict renders, mark it false positive or false
          negative to correct the classifier&apos;s feedback corpus.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runTest();
          }}
          placeholder="Paste text to check for prompt injection, jailbreak, or other unsafe content."
          rows={4}
          data-testid="classifier-test-input"
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
        />

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={runTest}
            disabled={!content.trim() || isMutating}
            data-testid="classifier-test-run"
          >
            <Play className="h-3.5 w-3.5" aria-hidden />
            {isMutating ? 'Running…' : 'Run test'}
          </Button>
          <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter</span>
          {requestFailed && (
            <span
              className="text-xs text-destructive"
              data-testid="classifier-test-error"
            >
              Request failed. Is pact-gateway running?
            </span>
          )}
        </div>

        {result && !requestFailed && (
          <div
            className="flex flex-col gap-3 border-t pt-3"
            data-testid="classifier-test-result"
          >
            {classifier ? (
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
                    classifier.label && classifier.label !== 'benign'
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-green-500/10 text-green-600 dark:text-green-400'
                  }`}
                >
                  <BrainCircuit className="h-3 w-3" aria-hidden />
                  {classifier.label ?? 'unknown'}
                </span>
                {typeof classifier.score === 'number' && (
                  <span className="text-xs font-medium">
                    {(classifier.score * 100).toFixed(0)}% score
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {result.latency_ms} ms
                </span>
              </div>
            ) : (
              <p
                className="text-xs text-muted-foreground"
                data-testid="classifier-test-no-verdict"
              >
                Classifier stage did not run for this request (an earlier stage
                already decided it).
              </p>
            )}

            {classifier?.label && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={labelButtonsDisabled || action !== 'false_positive'}
                  title={
                    action !== 'false_positive'
                      ? 'This verdict already reads benign -- mark false negative instead.'
                      : undefined
                  }
                  onClick={() => void handleLabel('false_positive')}
                  data-testid="classifier-test-mark-fp"
                >
                  <Flag className="h-3.5 w-3.5" aria-hidden />
                  Mark false positive
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={labelButtonsDisabled || action !== 'false_negative'}
                  title={
                    action !== 'false_negative'
                      ? 'This verdict is already flagged -- mark false positive instead.'
                      : undefined
                  }
                  onClick={() => void handleLabel('false_negative')}
                  data-testid="classifier-test-mark-fn"
                >
                  <Flag className="h-3.5 w-3.5" aria-hidden />
                  Mark false negative
                </Button>

                {labeledAction && (
                  <span
                    className="rounded bg-green-500/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-green-600 dark:text-green-400"
                    data-testid="classifier-test-label-confirm"
                  >
                    labeled {labeledAction.replace('_', ' ')}
                  </span>
                )}
                {labelErrorMessage && (
                  <span
                    className="text-xs text-destructive"
                    data-testid="classifier-test-label-error"
                  >
                    {labelErrorMessage}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
