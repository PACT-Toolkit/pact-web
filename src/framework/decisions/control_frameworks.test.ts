import { describe, expect, it } from 'vitest';

import {
  collectDecisionControls,
  controlLabel,
  KNOWN_CONTROL_FRAMEWORKS,
} from '@/src/framework/decisions/control_frameworks';

describe('controlLabel', () => {
  it('labels the known frameworks with their short prefix', () => {
    expect(controlLabel({ framework: 'owasp_llm_top10', id: 'LLM01' })).toBe(
      'OWASP LLM01'
    );
    expect(
      controlLabel({ framework: 'eu_ai_act_art15', id: 'cybersecurity' })
    ).toBe('AI Act Art. 15 cybersecurity');
  });

  it('falls back to the raw framework value for an unknown framework instead of throwing', () => {
    expect(controlLabel({ framework: 'iso_42001', id: 'A.6' })).toBe(
      'iso_42001 A.6'
    );
  });

  it('exposes the known frameworks for the filter select', () => {
    expect(KNOWN_CONTROL_FRAMEWORKS.map((f) => f.value)).toEqual([
      'owasp_llm_top10',
      'eu_ai_act_art15',
    ]);
  });
});

describe('collectDecisionControls', () => {
  it('de-duplicates framework+id pairs across stages, keeping first-seen order', () => {
    const controls = collectDecisionControls({
      filter: {
        controls: [
          { framework: 'owasp_llm_top10', id: 'LLM01' },
          { framework: 'eu_ai_act_art15', id: 'cybersecurity' },
        ],
      },
      classifier: {
        controls: [
          { framework: 'owasp_llm_top10', id: 'LLM01' },
          { framework: 'eu_ai_act_art15', id: 'accuracy' },
        ],
      },
    });

    expect(controls).toEqual([
      { framework: 'owasp_llm_top10', id: 'LLM01' },
      { framework: 'eu_ai_act_art15', id: 'cybersecurity' },
      { framework: 'eu_ai_act_art15', id: 'accuracy' },
    ]);
  });

  it('reads controls from external_refs too and returns [] when no stage has any', () => {
    expect(
      collectDecisionControls({
        external_refs: {
          source: 'external_ref',
          scanned: 1,
          blocked: 0,
          controls: [{ framework: 'owasp_llm_top10', id: 'LLM01' }],
        },
      })
    ).toEqual([{ framework: 'owasp_llm_top10', id: 'LLM01' }]);
    expect(collectDecisionControls({ filter: { verdict: 'safe' } })).toEqual(
      []
    );
  });
});
