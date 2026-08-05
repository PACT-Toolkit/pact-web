import {
  Brain,
  Eraser,
  Globe,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';

// The pipeline stages the Test Lab and the audit console both visualise, in
// true gateway execution order (policy -> filter -> classifier -> sandbox ->
// consensus -> redactor -> tool-mitigation -> CEL; policy/tool-mitigation/CEL
// are virtual stages with no chip in either UI). This order mirrors
// test_lab_check.ts's deriveLayerDefinitions doc comment, the original
// source of it -- sandbox sits between classifier and consensus because
// that is its real execution position, not because it was added last.
export type PipelineStageId =
  | 'filter'
  | 'classifier'
  | 'sandbox'
  | 'consensus'
  | 'redactor';

export const PIPELINE_STAGE_ORDER: PipelineStageId[] = [
  'filter',
  'classifier',
  'sandbox',
  'consensus',
  'redactor',
];

export const PIPELINE_STAGE_LABEL: Record<PipelineStageId, string> = {
  filter: 'Filter',
  classifier: 'Classifier',
  sandbox: 'Sandbox',
  consensus: 'Consensus',
  redactor: 'Redactor',
};

// One icon per pipeline stage (PACT-703 added consensus/redactor/sandbox
// alongside the original filter/classifier pair). Shared between the Test
// Lab's TestLabLayerNode and the audit console's StageStrip (PACT-748) --
// promoted here on its second use per the shared-code rule rather than kept
// as two copies of the same map. Keyed by plain string (not the closed
// PipelineStageId) because TestLabLayerNode indexes it with LayerState.id,
// which is a plain string; Brain is the fallback for any stage id neither
// map has been updated for yet.
export const PIPELINE_STAGE_ICON: Record<string, LucideIcon> = {
  filter: Shield,
  classifier: Brain,
  sandbox: Globe,
  consensus: Users,
  redactor: Eraser,
};
