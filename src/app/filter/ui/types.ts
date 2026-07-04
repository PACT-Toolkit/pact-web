// UI-state types for the filter console (PACT-325). Visual/form state only --
// wire shapes and business helpers live in domain/ (see pact-domain-layer).

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
