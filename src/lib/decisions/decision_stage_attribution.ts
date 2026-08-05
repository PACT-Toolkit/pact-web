import { type DecisionPayload } from '@/src/lib/decisions/decision_payload';

// The wire's `engine` field (PACT-745) is a closed set of eight values, but
// only five correspond to a pipeline stage the product visualises today
// (Test Lab's layer chips): filter, classifier, consensus, redactor,
// sandbox. The other three are real block reasons with a real engine value,
// but none of them land on a visualised stage: policy (PACT-335's token/tool
// gate, stage 0, before the filter even runs), gateway (pre-pipeline
// rejection -- body-too-large, decode failure), and cel (PACT-335 tier-3 CEL
// rule escalation, which runs after every visualised stage). This is the
// engine-keyed twin of test_lab_check.ts's BLOCKING_STAGE_OF, which encodes
// the identical exclusion for the /v1/check wire's reason-keyed field --
// the two contracts are never unified (see decision_payload.ts), so each
// needs its own closed set, but the excluded engines/reasons name the same
// three virtual stages.
const STAGE_ATTRIBUTED_ENGINES: ReadonlySet<string> = new Set([
  'filter',
  'classifier',
  'consensus',
  'redactor',
  'sandbox',
]);

// True when a decision's diagnostics.causal_spans can be pinned to one
// visualised pipeline stage. False for policy/gateway/cel blocks, and for
// payloads that carry causal_spans with no engine at all (older payloads
// predating PACT-745) -- in every false case the spans are still real data,
// they just were not attributed to a single stage by the gateway.
export const isStageAttributed = (payload: DecisionPayload): boolean =>
  payload.engine !== undefined && STAGE_ATTRIBUTED_ENGINES.has(payload.engine);
