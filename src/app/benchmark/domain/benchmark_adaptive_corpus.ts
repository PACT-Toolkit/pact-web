/**
 * Bundled campaign corpora the adaptive attack form offers. The server
 * validates the name against its own campaign directory, so this list is a
 * convenience for the select, not an authority.
 */
export const ADAPTIVE_CAMPAIGN_CORPORA = [
  'pact-801-attack-sample-v1.jsonl',
  'pact-802-heldout-v1.jsonl',
  'pact-802-heldout-v2.jsonl',
  'pact-802-heldout-v3.jsonl',
  'pact-809-harvest-sample-v1.jsonl',
  'pact-809-harvest-sample-v1-clean.jsonl',
] as const;

export const DEFAULT_ADAPTIVE_CAMPAIGN_CORPUS = ADAPTIVE_CAMPAIGN_CORPORA[0];

export interface AdaptiveCampaignPreset {
  id: 'full' | 'demo';
  label: string;
  /** Run only the first N goals; 0 runs every goal of the corpus. */
  goalLimit: number;
}

export const ADAPTIVE_CAMPAIGN_PRESETS: readonly AdaptiveCampaignPreset[] = [
  { id: 'full', label: 'Full run', goalLimit: 0 },
  { id: 'demo', label: 'Demo (3 goals)', goalLimit: 3 },
];

export const DEFAULT_ADAPTIVE_CAMPAIGN_PRESET_ID: AdaptiveCampaignPreset['id'] =
  'demo';

/** The preset for an id, falling back to the default preset. */
export const adaptiveCampaignPreset = (id: string): AdaptiveCampaignPreset =>
  ADAPTIVE_CAMPAIGN_PRESETS.find((preset) => preset.id === id) ??
  ADAPTIVE_CAMPAIGN_PRESETS.find(
    (preset) => preset.id === DEFAULT_ADAPTIVE_CAMPAIGN_PRESET_ID
  )!;
