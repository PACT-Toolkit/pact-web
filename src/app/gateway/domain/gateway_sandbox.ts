// Domain types and helpers for the sandbox / indirect-injection section
// (PACT-236 external_refs re-scan). Sourced live from the /v1/check response
// -- NOT the pact.decisions audit feed. pact-gateway's
// internal/kafka/producer.go deliberately excludes PurifiedContent from the
// audit event ("it contains third-party fetched content and has not been
// through the redactor stage... Callers receive purified_content on the
// /v1/check HTTP response only"), so a historical/audit-backed view could
// show verdicts but never the purified content the issue asks for. An ad-hoc
// probe (same shape as ClassifierTestPanel/RedactorTestPanel) is the only
// reachable source for the full field set.
import {
  type CheckCheckRequest,
  type CheckExternalRefInfo,
  type CheckExternalRefsInfo,
} from '@/src/__codegen__/rest/check';

export type ExternalRefVerdict =
  | 'clean'
  | 'hostile'
  | 'unfetchable'
  | 'mitigated';

export type ExternalRefRecord = CheckExternalRefInfo;
export type ExternalRefsSummary = CheckExternalRefsInfo;

// Canned probe references: one that resolves clean, one that resolves
// hostile in the mock backend (src/app/gateway/mock/data/gateway.ts's
// runSandboxProbe keys off "malicious-payload.example" -- see that file's
// docblock). Against a real gateway, whether either of these two hosts
// actually reports hostile depends on the live sandbox scan; the point of the
// probe is to exercise the real /v1/check external_refs contract end to end.
export const SANDBOX_PROBE_REFS: CheckCheckRequest['external_refs'] = [
  { source: 'rag:doc#12', url: 'https://docs.example.com/onboarding' },
  {
    source: 'tool:web_search',
    url: 'https://malicious-payload.example/result',
  },
];

export const buildSandboxProbeRequest = (): CheckCheckRequest => ({
  content: 'Summarize the linked references for the user.',
  kind: 'input',
  external_refs: SANDBOX_PROBE_REFS,
});

export const verdictBadgeClass = (verdict?: string): string => {
  if (verdict === 'hostile') return 'bg-destructive/10 text-destructive';
  if (verdict === 'mitigated')
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  if (verdict === 'unfetchable') return 'bg-muted text-muted-foreground';

  return 'bg-green-500/10 text-green-600 dark:text-green-400';
};
