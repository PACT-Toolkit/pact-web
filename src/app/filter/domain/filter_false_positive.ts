import {
  listDecisionAnnotations,
  type AnnotateDecisionRequest,
  type AuditEvent,
  type ListDecisionAnnotationsResponse,
} from '@/src/__codegen__/rest/audit';
import { type ClassifierLabelVerdictRequest } from '@/src/__codegen__/rest/classifier';
import { type DecisionPayload } from '@/src/app/filter/domain/filter_decision';

// PACT-325 wires FilterDecisionRow's "Flag as false positive" button to
// gateway's POST /v1/classifier/label (PACT-318) so an operator's correction
// feeds pact-classifier's fine-tune feedback corpus. That endpoint
// hard-requires a non-empty `content` field at runtime (pact-gateway
// internal/features/classifier/handler.go's labelVerdict; the OpenAPI spec
// was caught up to this in PACT-456/commit bf2c77c) -- but pact.decisions
// audit rows never carry raw content by design. pact-gateway's
// internal/kafka/producer.go documents this explicitly on ContentRef: "PACT
// is a redaction system -- raw prompt content is deliberately never
// persisted in the audit trail." ClassifierTestPanel.tsx hit the same wall
// and worked around it by only offering the label action right after an
// operator pastes fresh text; the filter console's rows are historical,
// already-decided rows with no fresh text to offer.
//
// Rather than leaving the button permanently disabled (defeating PACT-325's
// ask), this sends a clearly-marked, non-natural-language placeholder in
// `content` and tags the request with a distinct `source` so anyone curating
// the classifier's fine-tune feedback corpus can filter these rows out --
// they carry no usable training text, only an operator-confirmed FP signal
// against a requestId. predictedLabel is "unknown" (a valid member of the
// classifier's label enum) because the flat filter-stage DecisionPayload
// never carries a classifier label -- the block came from the regex/rule
// engine, not the classifier.
//
// This write is distinct from, and fires alongside, the decision-annotation
// write below -- LabelVerdict only ever reaches pact-classifier's corpus, it
// has no bearing on whether the row renders as flagged. See PACT-474 for the
// annotation persistence this file also owns.
const FALSE_POSITIVE_SOURCE = 'filter_console_decision_flag';

export const buildFilterFalsePositiveLabelRequest = (
  requestId: string,
  payload: DecisionPayload | null
): ClassifierLabelVerdictRequest => ({
  requestId,
  content: `[content unavailable -- pact.decisions audit rows never retain raw content] rule=${payload?.filter?.rule_id ?? 'n/a'} reason=${payload?.reason ?? 'n/a'}`,
  predictedLabel: 'unknown',
  operatorLabel: 'false_positive',
  source: FALSE_POSITIVE_SOURCE,
});

// Resolves the identifier the flag request should key off. Prefers the
// audit row's own requestId (gateway-assigned correlation id) and falls
// back to the payload's own request_id copy for older mock fixtures that
// only ever populated the payload field.
export const resolveFlagRequestId = (
  event: AuditEvent,
  payload: DecisionPayload | null
): string | undefined => event.requestId || payload?.request_id;

// PACT-474: durable false-positive persistence via pact-gateway's decision
// annotations proxy (PACT-464/PACT-466), replacing the PACT-325 sessionStorage
// stand-in. Writes go through POST /v1/audit/annotations (below); reads are
// batched per page of visible rows through POST /v1/audit/annotations/query
// rather than one call per row, wired as a plain useSWR read keyed on the
// page's request-id list (see buildDecisionAnnotationsQueryKey/
// fetchDecisionAnnotations) since orval only emits a useSWRMutation hook for
// this POST-for-query endpoint, not a query hook.
//
// UN-FLAGGING IS NOT SUPPORTED (PACT-464/PACT-466): AnnotateDecision is an
// idempotent *create* -- there is no delete/un-flag RPC on pact-audit's
// DecisionAnnotation surface. Once an operator flags a decision, it stays
// flagged for good. FilterDecisionRow renders the flag as present-only (the
// button disables once isFlagged is true) rather than offering a toggle that
// would imply an un-flag path that does not exist.
export const buildAnnotateDecisionRequest = (
  requestId: string
): AnnotateDecisionRequest => ({
  requestId,
  kind: 'false_positive',
});

const DECISION_ANNOTATIONS_QUERY_KEY_PREFIX = 'filter-decision-annotations';

// SWR key for the batched annotations read. Returns null (disabling the
// useSWR call, per pact-react-patterns SWR key discipline) when the current
// page has no request ids to look up, rather than firing a request the mock
// and real gateway both 400 on (empty requestIds).
export const buildDecisionAnnotationsQueryKey = (
  requestIds: readonly string[]
): readonly [string, ...string[]] | null =>
  requestIds.length > 0
    ? [DECISION_ANNOTATIONS_QUERY_KEY_PREFIX, ...requestIds]
    : null;

// useSWR fetcher for the key above. No orval query hook exists for this
// endpoint (POST-for-query only emits a useSWRMutation hook), so this calls
// the generated fetcher function directly, per pact-react-patterns Rule 1's
// "if no hook exists, use useSWR directly."
export const fetchDecisionAnnotations = async (
  key: readonly [string, ...string[]]
): Promise<ListDecisionAnnotationsResponse> => {
  const [, ...requestIds] = key;
  const response = await listDecisionAnnotations({ requestIds });
  if (response.status !== 200) {
    throw new Error(`Failed to load decision annotations (${response.status})`);
  }

  return response.data;
};

// Derives the set of requestIds an operator has already flagged from a
// batched annotations/query response. Filters on kind client-side (the
// pact-audit RPC accepts a kinds filter, but pact-gateway's JSON contract
// does not expose it -- see the /annotations/query path's swagger comment)
// even though false_positive is the only kind that exists today, so this
// keeps working unmodified if a second kind is ever introduced.
export const extractFlaggedFalsePositiveRequestIds = (
  data: ListDecisionAnnotationsResponse | undefined
): ReadonlySet<string> =>
  new Set(
    (data?.annotations ?? [])
      .filter((annotation) => annotation.kind === 'false_positive')
      .map((annotation) => annotation.requestId)
  );

export const isFlaggedFalsePositive = (
  flaggedRequestIds: ReadonlySet<string>,
  requestId: string | undefined
): boolean => requestId !== undefined && flaggedRequestIds.has(requestId);

// Optimistic-update transform for the annotations/query SWR cache. Inserts a
// synthetic DecisionAnnotation for requestId so the row renders as flagged
// immediately, before the write resolves. actor/createdAt are placeholders
// (the write response never echoes them back -- see the /annotations path's
// swagger comment) and are never read by isFlaggedFalsePositive/
// extractFlaggedFalsePositiveRequestIds, which only look at requestId+kind;
// the revalidate that follows a successful write replaces this with the
// real row. rollbackOnError (wired at the call site) reverts this if the
// write fails.
//
// Always returns a concrete response (never undefined) -- SWR's mutate()
// optimisticData callback for a useSWR<T> cache must return T, not T |
// undefined, and treating "no cached data yet" as an empty annotations list
// is the correct optimistic guess anyway (an empty page render swapped for
// the real page on the revalidate this call is paired with).
export const applyOptimisticAnnotationFlag = (
  current: ListDecisionAnnotationsResponse | undefined,
  requestId: string
): ListDecisionAnnotationsResponse => {
  const annotations = current?.annotations ?? [];
  if (
    annotations.some(
      (annotation) =>
        annotation.requestId === requestId &&
        annotation.kind === 'false_positive'
    )
  ) {
    return current ?? { annotations };
  }

  return {
    annotations: [
      ...annotations,
      {
        requestId,
        kind: 'false_positive',
        actor: '',
        createdAt: new Date().toISOString(),
      },
    ],
  };
};
