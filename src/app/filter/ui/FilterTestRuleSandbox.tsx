'use client';

import { FlaskConical, Play } from 'lucide-react';
import { useState } from 'react';

import { useTestRule } from '@/src/__codegen__/rest/filter';
import {
  DEFAULT_TEST_RULE_FORM,
  TEST_RULE_ACTION_OPTIONS,
  TEST_RULE_KIND_OPTIONS,
  TEST_RULE_VERDICT_OPTIONS,
  buildTestRuleRequest,
  isRuleMatch,
  validateTestRuleForm,
  verdictBadgeClass,
} from '@/src/app/filter/domain/filter_test_rule';
import { type TestRuleFormState } from '@/src/app/filter/ui/types';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';

const selectClassName = 'h-9 rounded-md border bg-background px-3 text-sm';
const textareaClassName =
  'w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none';

// TestRule sandbox (pact-gateway PACT-451's POST /v1/filter/test-rule, wired
// here under PACT-325 part 2). Paste a candidate rule (pattern + verdict)
// and a sample and see whether pact-filter's engine would match it, before
// creating the rule for real via POST /v1/rules. No side effects -- nothing
// here is persisted or audited (see pact-gateway
// internal/features/filter/handler.go's testRule docblock).
export const FilterTestRuleSandbox = () => {
  const [form, setForm] = useState<TestRuleFormState>(DEFAULT_TEST_RULE_FORM);
  const [validationError, setValidationError] = useState<string | undefined>(
    undefined
  );
  const { trigger: runTestRule, data, error, isMutating } = useTestRule();

  const result = data?.status === 200 ? data.data : undefined;
  const requestFailed =
    Boolean(error) || (data !== undefined && data.status !== 200);
  const serverErrorMessage =
    data !== undefined && data.status !== 200 ? data.data : undefined;

  const setField = <K extends keyof TestRuleFormState>(
    key: K,
    value: TestRuleFormState[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const runTest = () => {
    const message = validateTestRuleForm(form);
    setValidationError(message);
    if (message) return;

    void runTestRule(buildTestRuleRequest(form));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4" aria-hidden />
          TestRule sandbox
        </CardTitle>
        <CardDescription>
          Paste a candidate rule and a sample, then run it through
          pact-filter&apos;s engine. Nothing here is persisted or audited.
        </CardDescription>
      </CardHeader>
      <CardContent
        className="flex flex-col gap-3"
        data-testid="filter-test-rule-panel"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="filter-test-rule-pattern"
            >
              Pattern
            </label>
            <Input
              id="filter-test-rule-pattern"
              value={form.pattern}
              onChange={(e) => setField('pattern', e.target.value)}
              placeholder="ignore (all )?previous instructions"
              data-testid="filter-test-rule-pattern"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="filter-test-rule-rule-id"
            >
              Rule ID (optional)
            </label>
            <Input
              id="filter-test-rule-rule-id"
              value={form.ruleId}
              onChange={(e) => setField('ruleId', e.target.value)}
              placeholder="candidate-1"
              data-testid="filter-test-rule-rule-id"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="filter-test-rule-verdict"
            >
              Verdict
            </label>
            <select
              id="filter-test-rule-verdict"
              value={form.verdict}
              onChange={(e) => setField('verdict', e.target.value)}
              className={selectClassName}
              data-testid="filter-test-rule-verdict"
            >
              {TEST_RULE_VERDICT_OPTIONS.map((verdict) => (
                <option key={verdict} value={verdict}>
                  {verdict}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="filter-test-rule-kind"
            >
              Kind
            </label>
            <select
              id="filter-test-rule-kind"
              value={form.kind}
              onChange={(e) =>
                setField('kind', e.target.value as TestRuleFormState['kind'])
              }
              className={selectClassName}
              data-testid="filter-test-rule-kind"
            >
              {TEST_RULE_KIND_OPTIONS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="filter-test-rule-action"
            >
              Action (optional)
            </label>
            <select
              id="filter-test-rule-action"
              value={form.action}
              onChange={(e) => setField('action', e.target.value)}
              className={selectClassName}
              data-testid="filter-test-rule-action"
            >
              {TEST_RULE_ACTION_OPTIONS.map((action) => (
                <option key={action || '__none__'} value={action}>
                  {action || '(none)'}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="text-xs text-muted-foreground"
              htmlFor="filter-test-rule-tags"
            >
              Tags (comma-separated, optional)
            </label>
            <Input
              id="filter-test-rule-tags"
              value={form.tags}
              onChange={(e) => setField('tags', e.target.value)}
              placeholder="injection, draft"
              data-testid="filter-test-rule-tags"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="text-xs text-muted-foreground"
            htmlFor="filter-test-rule-content"
          >
            Sample content
          </label>
          <textarea
            id="filter-test-rule-content"
            value={form.content}
            onChange={(e) => setField('content', e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runTest();
            }}
            placeholder="Paste the sample text to test the candidate rule against."
            rows={3}
            className={textareaClassName}
            data-testid="filter-test-rule-content"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={runTest}
            disabled={isMutating}
            data-testid="filter-test-rule-run"
          >
            <Play className="h-3.5 w-3.5" aria-hidden />
            {isMutating ? 'Running…' : 'Run test'}
          </Button>
          <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter</span>
          {validationError && (
            <span
              className="text-xs text-destructive"
              data-testid="filter-test-rule-validation-error"
            >
              {validationError}
            </span>
          )}
          {!validationError && requestFailed && (
            <span
              className="text-xs text-destructive"
              data-testid="filter-test-rule-error"
            >
              {serverErrorMessage ?? 'Request failed. Is pact-gateway running?'}
            </span>
          )}
        </div>

        {result && !requestFailed && (
          <div
            className="flex flex-col gap-3 border-t pt-3"
            data-testid="filter-test-rule-result"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${verdictBadgeClass(result.verdict)}`}
                data-testid="filter-test-rule-verdict-badge"
              >
                {isRuleMatch(result.verdict) ? 'MATCH' : 'NO MATCH'} ·{' '}
                {result.verdict.toUpperCase()}
              </span>
              {typeof result.confidence === 'number' && (
                <span className="text-xs font-medium">
                  {(result.confidence * 100).toFixed(0)}% confidence
                </span>
              )}
              {typeof result.latencyMs === 'number' && (
                <span className="text-xs text-muted-foreground">
                  {result.latencyMs} ms
                </span>
              )}
            </div>

            {result.reason && (
              <p className="text-xs text-muted-foreground">{result.reason}</p>
            )}

            {result.matchedSpan && (
              <div
                className="rounded-md border bg-muted/40 p-2 text-xs"
                data-testid="filter-test-rule-matched-span"
              >
                Matched span [{result.matchedSpan.start}
                {'–'}
                {result.matchedSpan.end}]:{' '}
                <code>{result.matchedSpan.text}</code>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
