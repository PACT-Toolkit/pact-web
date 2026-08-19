// UI-state types for the filter console (PACT-325). Visual/form state only --
// wire shapes and business helpers live in domain/ (see pact-domain-layer).

// Which flag-toggle action a row's last attempt failed on (PACT-835). Keyed
// per-event in FilterDecisionsWorkbench so FilterDecisionRow can render
// "Flag failed." vs "Unflag failed." from the action the operator actually
// attempted, rather than inferring it from isFlagged -- that state reflects
// the post-rollback/revalidation server truth, which can disagree with the
// attempted action when a flag's classifier-label write fails after its
// annotation write already succeeded.
export type FlagToggleFailureAction = 'flag' | 'unflag';

export interface TestRuleFormState {
  pattern: string;
  verdict: string;
  kind: 'input' | 'output' | 'external_content';
  content: string;
  ruleId: string;
  description: string;
  action: string;
  // Comma-separated in the form; parsed into a string[] by
  // filter_test_rule.ts's buildTestRuleRequest before it hits the wire.
  tags: string;
}
