import { describe, expect, it } from 'vitest';

import {
  buildImportRequest,
  buildPreviewParams,
  describeHubImportError,
  normalizeDetectedColumn,
  NO_LABEL_COLUMN,
  normalizeLabelValueKey,
  previewToDistinctValues,
  resolveHubImportMapping,
  type HubDatasetIdentity,
  type HubDatasetPreview,
} from '@/src/app/benchmark/domain/benchmark_import';

const IDENTITY: HubDatasetIdentity = {
  slug: 'deepset/prompt-injections',
  split: '',
  config: '',
  revision: '',
};

const PREVIEW: HubDatasetPreview = {
  columns: ['text', 'label'],
  row_count: 662,
  sampled_rows: 200,
  detected_text_column: 'text',
  detected_label_column: 'label',
  label_values: ['0', '1'],
  label_values_truncated: false,
  suggested_label_values: { '0': 'allow', '1': 'block' },
  suggested_assume_label: '',
  score_column: '',
  suggested_threshold: 0,
  score_sample_block_rows: 0,
  score_sample_allow_rows: 0,
};

const UNLABELED_PREVIEW: HubDatasetPreview = {
  columns: ['Name', 'Prompt'],
  row_count: 79,
  sampled_rows: 79,
  detected_text_column: 'Prompt',
  detected_label_column: '',
  label_values: [],
  label_values_truncated: false,
  suggested_label_values: {},
  suggested_assume_label: 'block',
  score_column: '',
  suggested_threshold: 0,
  score_sample_block_rows: 0,
  score_sample_allow_rows: 0,
};

// Mirrors the real jailbreak collection: a score column AND a suggested
// assume-label, with no label column.
const SCORED_PREVIEW: HubDatasetPreview = {
  ...UNLABELED_PREVIEW,
  score_column: 'Jailbreak Score',
  suggested_threshold: 47.5,
  score_sample_block_rows: 57,
  score_sample_allow_rows: 22,
};

const NO_SELECTIONS = {
  textColumn: null,
  labelColumn: null,
  assumeLabel: null,
  scoreThreshold: null,
};

describe('buildPreviewParams', () => {
  it('sends only the slug when every other field is blank', () => {
    expect(buildPreviewParams(IDENTITY, null, null)).toEqual({
      slug: 'deepset/prompt-injections',
    });
  });

  it('trims and includes split, config, and revision when set', () => {
    const identity: HubDatasetIdentity = {
      slug: '  deepset/prompt-injections  ',
      split: ' train ',
      config: ' default ',
      revision: ' main ',
    };

    expect(buildPreviewParams(identity, null, null)).toEqual({
      slug: 'deepset/prompt-injections',
      split: 'train',
      config: 'default',
      revision: 'main',
    });
  });

  it('omits label_column for the no-label-column sentinel', () => {
    expect(buildPreviewParams(IDENTITY, NO_LABEL_COLUMN, null)).toEqual({
      slug: 'deepset/prompt-injections',
    });
  });

  it('includes label_column only when an override is given', () => {
    expect(buildPreviewParams(IDENTITY, 'label_alt', null)).toEqual({
      slug: 'deepset/prompt-injections',
      label_column: 'label_alt',
    });
  });
});

describe('buildPreviewParams score threshold', () => {
  it('omits score_threshold while untouched', () => {
    expect(buildPreviewParams(IDENTITY, null, null)).not.toHaveProperty(
      'score_threshold'
    );
  });

  it('includes score_threshold when 0 or 50', () => {
    expect(buildPreviewParams(IDENTITY, null, 0).score_threshold).toBe(0);
    expect(buildPreviewParams(IDENTITY, null, 50).score_threshold).toBe(50);
  });
});

describe('normalizeDetectedColumn', () => {
  it('returns null for an empty string', () => {
    expect(normalizeDetectedColumn('')).toBeNull();
  });

  it('returns null for a whitespace-only string', () => {
    expect(normalizeDetectedColumn('   ')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(normalizeDetectedColumn(undefined)).toBeNull();
  });

  it('returns the column name unchanged when populated', () => {
    expect(normalizeDetectedColumn('text')).toBe('text');
  });
});

describe('previewToDistinctValues', () => {
  it('returns null when no label column is in effect', () => {
    expect(previewToDistinctValues(PREVIEW, null)).toBeNull();
  });

  it('takes the default decisions from suggested_label_values', () => {
    expect(previewToDistinctValues(PREVIEW, 'label')).toEqual({
      ok: true,
      values: ['0', '1'],
      defaultDecisions: { '0': 'allow', '1': 'block' },
    });
  });

  it('defaults a value missing from the suggestions to skip', () => {
    const preview: HubDatasetPreview = {
      ...PREVIEW,
      label_values: ['positive', 'negative'],
      suggested_label_values: { positive: 'block' },
    };

    expect(previewToDistinctValues(preview, 'label')).toEqual({
      ok: true,
      values: ['positive', 'negative'],
      defaultDecisions: { positive: 'block', negative: 'skip' },
    });
  });

  it('does not apply the client vocabulary when the gateway suggests nothing', () => {
    const preview: HubDatasetPreview = {
      ...PREVIEW,
      label_values: ['block', 'allow'],
      suggested_label_values: {},
    };

    expect(previewToDistinctValues(preview, 'label')).toEqual({
      ok: true,
      values: ['block', 'allow'],
      defaultDecisions: { block: 'skip', allow: 'skip' },
    });
  });
});

describe('resolveHubImportMapping', () => {
  it('uses the detected columns and flags them as auto-detected', () => {
    expect(resolveHubImportMapping(PREVIEW, NO_SELECTIONS)).toEqual({
      textColumn: 'text',
      labelColumn: 'label',
      scoreColumn: null,
      scoreThreshold: null,
      assumeLabel: null,
      textColumnAutoDetected: true,
      labelColumnAutoDetected: true,
      assumeLabelAutoDetected: false,
      scoreThresholdAutoDetected: false,
    });
  });

  it('lets a user text column override the detection', () => {
    const resolved = resolveHubImportMapping(PREVIEW, {
      ...NO_SELECTIONS,
      textColumn: 'other',
    });

    expect(resolved.textColumn).toBe('other');
    expect(resolved.textColumnAutoDetected).toBe(false);
  });

  it('lets a user label column override the detection', () => {
    const resolved = resolveHubImportMapping(PREVIEW, {
      ...NO_SELECTIONS,
      labelColumn: 'label_alt',
    });

    expect(resolved.labelColumn).toBe('label_alt');
    expect(resolved.labelColumnAutoDetected).toBe(false);
  });

  it('clears a detected label column for the sentinel', () => {
    const resolved = resolveHubImportMapping(PREVIEW, {
      ...NO_SELECTIONS,
      labelColumn: NO_LABEL_COLUMN,
    });

    expect(resolved.labelColumn).toBeNull();
    expect(resolved.labelColumnAutoDetected).toBe(false);
    expect(resolved.assumeLabel).toBeNull();
  });

  it('derives the assume-label from the suggestion when no label column exists', () => {
    const resolved = resolveHubImportMapping(UNLABELED_PREVIEW, NO_SELECTIONS);

    expect(resolved.labelColumn).toBeNull();
    expect(resolved.assumeLabel).toBe('block');
    expect(resolved.assumeLabelAutoDetected).toBe(true);
  });

  it('prefers the user assume-label over the suggestion', () => {
    const resolved = resolveHubImportMapping(UNLABELED_PREVIEW, {
      ...NO_SELECTIONS,
      assumeLabel: 'allow',
    });

    expect(resolved.assumeLabel).toBe('allow');
    expect(resolved.assumeLabelAutoDetected).toBe(false);
  });

  it('ignores a suggestion that is neither allow nor block', () => {
    const resolved = resolveHubImportMapping(
      { ...UNLABELED_PREVIEW, suggested_assume_label: '' },
      NO_SELECTIONS
    );

    expect(resolved.assumeLabel).toBeNull();
    expect(resolved.assumeLabelAutoDetected).toBe(false);
  });

  it('treats a missing preview as nothing detected', () => {
    expect(resolveHubImportMapping(undefined, NO_SELECTIONS)).toEqual({
      textColumn: null,
      labelColumn: null,
      scoreColumn: null,
      scoreThreshold: null,
      assumeLabel: null,
      textColumnAutoDetected: false,
      labelColumnAutoDetected: false,
      assumeLabelAutoDetected: false,
      scoreThresholdAutoDetected: false,
    });
  });

  it('takes the score path from the preview with the suggested threshold', () => {
    const resolved = resolveHubImportMapping(SCORED_PREVIEW, NO_SELECTIONS);

    expect(resolved.labelColumn).toBeNull();
    expect(resolved.scoreColumn).toBe('Jailbreak Score');
    expect(resolved.scoreThreshold).toBe(47.5);
    expect(resolved.scoreThresholdAutoDetected).toBe(true);
    // The preview still suggests an assume-label; the score path wins.
    expect(resolved.assumeLabel).toBeNull();
    expect(resolved.assumeLabelAutoDetected).toBe(false);
  });

  it('prefers the user threshold over the suggestion, including 0', () => {
    const resolved = resolveHubImportMapping(SCORED_PREVIEW, {
      ...NO_SELECTIONS,
      scoreThreshold: 0,
    });

    expect(resolved.scoreThreshold).toBe(0);
    expect(resolved.scoreThresholdAutoDetected).toBe(false);
  });

  it('lets a label column win over a score column', () => {
    const resolved = resolveHubImportMapping(
      { ...SCORED_PREVIEW, detected_label_column: 'label' },
      NO_SELECTIONS
    );

    expect(resolved.labelColumn).toBe('label');
    expect(resolved.scoreColumn).toBeNull();
    expect(resolved.scoreThreshold).toBeNull();
    expect(resolved.scoreThresholdAutoDetected).toBe(false);
  });

  it('returns to the score path when the label column is cleared', () => {
    const resolved = resolveHubImportMapping(
      { ...SCORED_PREVIEW, detected_label_column: 'label' },
      { ...NO_SELECTIONS, labelColumn: NO_LABEL_COLUMN }
    );

    expect(resolved.scoreColumn).toBe('Jailbreak Score');
    expect(resolved.assumeLabel).toBeNull();
  });
});

describe('normalizeLabelValueKey', () => {
  it('trims and lowercases', () => {
    expect(normalizeLabelValueKey('  Block  ')).toBe('block');
  });
});

describe('buildImportRequest', () => {
  it('omits every optional field left unset', () => {
    expect(
      buildImportRequest({
        identity: IDENTITY,
        textColumn: null,
        labelColumn: null,
        scoreColumn: null,
        scoreThreshold: null,
        valueDecisions: {},
        assumeLabel: null,
      })
    ).toEqual({ slug: 'deepset/prompt-injections' });
  });

  it('includes the mapped columns, label values, and identity fields when set', () => {
    const identity: HubDatasetIdentity = {
      slug: 'deepset/prompt-injections',
      split: 'train',
      config: 'default',
      revision: 'main',
    };

    expect(
      buildImportRequest({
        identity,
        textColumn: 'text',
        labelColumn: 'label',
        scoreColumn: null,
        scoreThreshold: null,
        valueDecisions: { block: 'block', allow: 'allow' },
        assumeLabel: null,
      })
    ).toEqual({
      slug: 'deepset/prompt-injections',
      split: 'train',
      config: 'default',
      revision: 'main',
      text_column: 'text',
      label_column: 'label',
      label_values: { block: 'block', allow: 'allow' },
    });
  });

  it('normalizes label_values keys and lets a later duplicate win', () => {
    const result = buildImportRequest({
      identity: IDENTITY,
      textColumn: 'text',
      labelColumn: 'label',
      scoreColumn: null,
      scoreThreshold: null,
      // "Block" and "block" collapse to the same normalized key; insertion
      // order means the second entry (allow) wins - documents the
      // last-write-wins contract described on buildImportRequest.
      valueDecisions: { Block: 'block', block: 'allow' },
      assumeLabel: null,
    });

    expect(result.label_values).toEqual({ block: 'allow' });
  });

  it('drops assume_label when a label column is mapped', () => {
    const result = buildImportRequest({
      identity: IDENTITY,
      textColumn: 'text',
      labelColumn: 'label',
      scoreColumn: null,
      scoreThreshold: null,
      valueDecisions: { '0': 'allow', '1': 'block' },
      assumeLabel: 'block',
    });

    expect(result.assume_label).toBeUndefined();
    expect(result.label_column).toBe('label');
  });

  it('includes assume_label when no label column is mapped', () => {
    const result = buildImportRequest({
      identity: IDENTITY,
      textColumn: 'prompt',
      labelColumn: null,
      scoreColumn: null,
      scoreThreshold: null,
      valueDecisions: {},
      assumeLabel: 'allow',
    });

    expect(result.assume_label).toBe('allow');
    expect(result.label_column).toBeUndefined();
  });
});

describe('buildImportRequest score path', () => {
  const scoreArgs = {
    identity: IDENTITY,
    textColumn: 'Prompt',
    labelColumn: null,
    scoreColumn: 'Jailbreak Score',
    scoreThreshold: 80,
    valueDecisions: {},
  } as const;

  it('emits the score fields and omits assume_label', () => {
    const result = buildImportRequest({ ...scoreArgs, assumeLabel: 'block' });

    expect(result.score_column).toBe('Jailbreak Score');
    expect(result.score_threshold).toBe(80);
    expect(result.assume_label).toBeUndefined();
  });

  it('keeps a zero threshold', () => {
    const result = buildImportRequest({
      ...scoreArgs,
      scoreThreshold: 0,
      assumeLabel: null,
    });

    expect(result.score_threshold).toBe(0);
  });

  it('omits the score fields when a label column is set', () => {
    const result = buildImportRequest({
      ...scoreArgs,
      labelColumn: 'label',
      assumeLabel: null,
    });

    expect(result.label_column).toBe('label');
    expect(result.score_column).toBeUndefined();
    expect(result.score_threshold).toBeUndefined();
  });
});

describe('describeHubImportError', () => {
  it('gives a fixed message for a gated dataset', () => {
    expect(describeHubImportError(403, { code: 'permission_denied' })).toBe(
      'This dataset is gated - the benchmark service has no access to it.'
    );
  });

  it('gives a fixed message for an unknown dataset/config/split', () => {
    expect(describeHubImportError(404, undefined)).toBe(
      'Dataset, config, or split not found.'
    );
  });

  it('gives a fixed message for a timed-out inspect', () => {
    expect(describeHubImportError(504, { code: 'timeout' })).toBe(
      'The dataset took too long to inspect. Try again - the first read of a dataset can be slow.'
    );
  });

  it('falls back to the server error body for other statuses', () => {
    expect(describeHubImportError(502, { error: 'upstream timeout' })).toBe(
      'upstream timeout'
    );
  });

  it('falls back to a generic message when the server body has no text', () => {
    expect(describeHubImportError(500, undefined)).toBe(
      'The gateway returned an error.'
    );
  });
});
