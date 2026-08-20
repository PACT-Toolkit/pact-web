import { type ClassifierLabelVerdictRequest } from '@/src/__codegen__/rest/classifier';

// The gateway's classifier.LabelVerdictRequest.operatorLabel enum also
// accepts "agree" (operator confirms the verdict was correct), but this
// ad-hoc test panel (PACT-322 part 2) only offers the two correction
// actions -- there is no "confirm" affordance here, same as the
// redactor/consensus consoles never offer a "this was right" button.
export type OperatorLabelAction = 'false_positive' | 'false_negative';

// Offered on a false-negative flag only: the classifier said "benign" but
// should have caught one of these. Without an explicit choice here,
// buildLabelVerdictRequest used to omit correctionLabel entirely on every
// false-negative flag, so the classifier's feedback corpus silently invented
// prompt_injection for every FN row regardless of what was actually missed.
// Kept to the three non-benign predictedLabel values (see
// availableLabelAction's docblock for the full vocabulary) -- "unspecified"
// and "unknown" aren't real corrections an operator would ever pick.
export type CorrectionLabel = 'prompt_injection' | 'jailbreak' | 'sensitive';

export const CORRECTION_LABEL_OPTIONS: readonly CorrectionLabel[] = [
  'prompt_injection',
  'jailbreak',
  'sensitive',
];

// "benign" is the only classifier label where a false NEGATIVE makes sense
// (the classifier said "safe" but the content should have been flagged);
// every other label is something the classifier already flagged, so the
// only sensible correction is a false POSITIVE (the classifier over-flagged
// content that was actually fine). See pact-web PR #118's field-name/enum
// note for the full predictedLabel vocabulary (unspecified | benign |
// prompt_injection | jailbreak | sensitive | unknown) -- this panel treats
// all non-benign values identically since none of them can be
// "under-flagged".
export const availableLabelAction = (label?: string): OperatorLabelAction =>
  label === 'benign' ? 'false_negative' : 'false_positive';

// Ad-hoc test panel source tag lets whoever reviews the classifier feedback
// corpus tell these corrections apart from ones recorded via other entry
// points (e.g. pact-gateway's handler_test.go uses "test_lab" as its own
// example source value).
const LABEL_SOURCE = 'classifier_test_panel';

export interface BuildLabelVerdictRequestParams {
  requestId: string;
  content: string;
  predictedLabel: string;
  predictedConfidence?: number;
  operatorLabel: OperatorLabelAction;
  // Required when operatorLabel is 'false_negative' (the UI only ever calls
  // this with one chosen -- see ClassifierTestPanel's picker); meaningless
  // for 'false_positive', so left undefined there.
  correctionLabel?: CorrectionLabel;
}

// Builds the POST /v1/classifier/label body. `content` is required both by
// the generated ClassifierLabelVerdictRequest type (PACT-456/commit bf2c77c
// caught the OpenAPI spec's `required` list up to this) and, more strictly,
// by the handler at runtime, which also 400s without requestId,
// predictedLabel, or operatorLabel -- none of which the spec declares
// required yet (a remaining gateway doc gap tracked as PACT-448; see
// pact-gateway internal/features/classifier/handler.go's labelVerdict).
// note is intentionally omitted: this panel doesn't collect free text.
export const buildLabelVerdictRequest = (
  params: BuildLabelVerdictRequestParams
): ClassifierLabelVerdictRequest => ({
  requestId: params.requestId,
  content: params.content,
  predictedLabel: params.predictedLabel,
  predictedConfidence: params.predictedConfidence,
  operatorLabel: params.operatorLabel,
  correctionLabel: params.correctionLabel,
  source: LABEL_SOURCE,
});
