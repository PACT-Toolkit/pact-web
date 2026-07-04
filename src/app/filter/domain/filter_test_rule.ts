import { type FilterTestRuleRequest } from '@/src/__codegen__/rest/filter';
import { type TestRuleFormState } from '@/src/app/filter/ui/types';

// Domain helpers for the TestRule sandbox (pact-gateway PACT-451, wired here
// under PACT-325). Lets an operator paste a candidate rule (pattern +
// verdict) and a sample and see whether pact-filter's engine would match it,
// without creating the rule via POST /v1/rules first. No side effects --
// pact-filter persists nothing for this call (see pact-gateway
// internal/features/filter/handler.go's testRule docblock).

export const TEST_RULE_KIND_OPTIONS = [
  'input',
  'output',
  'external_content',
] as const;

export const TEST_RULE_VERDICT_OPTIONS = ['hostile', 'suspicious'] as const;

export const TEST_RULE_ACTION_OPTIONS = ['', 'block', 'log'] as const;

export const DEFAULT_TEST_RULE_FORM: TestRuleFormState = {
  pattern: '',
  verdict: 'hostile',
  kind: 'input',
  content: '',
  ruleId: '',
  description: '',
  action: '',
  tags: '',
};

// Mirrors pact-gateway's validateTestRuleRequest so the sandbox surfaces the
// same "field is required" copy as a 400 would, before round-tripping to the
// gateway at all.
export const validateTestRuleForm = (
  form: TestRuleFormState
): string | undefined => {
  if (!form.pattern.trim()) return 'Pattern is required.';
  if (!form.verdict.trim()) return 'Verdict is required.';
  if (!form.content.trim()) return 'Sample content is required.';
  if (!TEST_RULE_KIND_OPTIONS.includes(form.kind)) {
    return 'Kind must be input, output, or external_content.';
  }

  return undefined;
};

const parseTags = (raw: string): string[] | undefined => {
  const tags = raw
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  return tags.length > 0 ? tags : undefined;
};

export const buildTestRuleRequest = (
  form: TestRuleFormState
): FilterTestRuleRequest => ({
  pattern: form.pattern,
  verdict: form.verdict,
  kind: form.kind,
  content: form.content,
  ruleId: form.ruleId.trim() || undefined,
  description: form.description.trim() || undefined,
  action: form.action || undefined,
  tags: parseTags(form.tags),
});

// The gateway's TestRuleResponse.verdict mirrors the filter engine's normal
// per-request verdict vocabulary ("safe" | "suspicious" | "hostile"). A
// sample matches the candidate rule whenever the engine reports anything
// other than "safe".
export const isRuleMatch = (verdict: string): boolean => verdict !== 'safe';

export const verdictBadgeClass = (verdict: string): string => {
  if (verdict === 'hostile') return 'bg-destructive/10 text-destructive';
  if (verdict === 'suspicious') {
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  }

  return 'bg-green-500/10 text-green-600 dark:text-green-400';
};
