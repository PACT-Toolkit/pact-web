import { type ControlRef } from '@/src/__codegen__/schema/pact-decisions';
import { type DecisionPayload } from '@/src/lib/decisions/decision_payload';

// Compliance frameworks the gateway stamps onto stage verdicts today. The
// wire schema keeps `framework` an open set, so this list only drives the
// audit filter's select and the friendly badge labels -- an unknown framework
// still renders (see controlLabel) and is never rejected.
export const KNOWN_CONTROL_FRAMEWORKS = [
  { value: 'owasp_llm_top10', label: 'OWASP LLM Top 10', badge: 'OWASP' },
  {
    value: 'eu_ai_act_art15',
    label: 'EU AI Act Art. 15',
    badge: 'AI Act Art. 15',
  },
];

export const controlLabel = ({ framework, id }: ControlRef): string => {
  const known = KNOWN_CONTROL_FRAMEWORKS.find((f) => f.value === framework);

  return `${known?.badge ?? framework} ${id}`;
};

// Every sub-object that carries a `controls` array on the wire. Compliance
// and cel have none by design (the gateway keeps no control table for them).
const controlSources = (
  payload: DecisionPayload
): (ControlRef[] | undefined)[] => [
  payload.policy?.controls,
  payload.filter?.controls,
  payload.classifier?.controls,
  payload.external_refs?.controls,
  payload.consensus?.controls,
  payload.redactor?.controls,
];

// Distinct framework+id pairs across all stages, in stage order. The same
// control is usually stamped by several stages (LLM01 on filter, classifier
// and consensus); the row shows it once.
export const collectDecisionControls = (
  payload: DecisionPayload
): ControlRef[] => {
  const seen = new Set<string>();
  const out: ControlRef[] = [];

  for (const controls of controlSources(payload)) {
    for (const control of controls ?? []) {
      const key = `${control.framework}\u0000${control.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(control);
    }
  }

  return out;
};
