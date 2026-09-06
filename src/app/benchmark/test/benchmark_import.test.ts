import { describe, expect, it } from 'vitest';

import {
  buildImportRequest,
  buildPreviewParams,
  describeHubImportError,
  normalizeLabelValueKey,
  previewToDistinctValues,
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
  label_values: ['block', 'allow'],
  label_values_truncated: false,
};

describe('buildPreviewParams', () => {
  it('sends only the slug when every other field is blank', () => {
    expect(buildPreviewParams(IDENTITY, null)).toEqual({
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

    expect(buildPreviewParams(identity, null)).toEqual({
      slug: 'deepset/prompt-injections',
      split: 'train',
      config: 'default',
      revision: 'main',
    });
  });

  it('includes label_column only when an override is given', () => {
    expect(buildPreviewParams(IDENTITY, 'label_alt')).toEqual({
      slug: 'deepset/prompt-injections',
      label_column: 'label_alt',
    });
  });
});

describe('previewToDistinctValues', () => {
  it('returns null when the preview found no label column', () => {
    expect(
      previewToDistinctValues({ ...PREVIEW, detected_label_column: '' })
    ).toBeNull();
  });

  it('maps every label value to its vocabulary-derived default decision', () => {
    expect(previewToDistinctValues(PREVIEW)).toEqual({
      ok: true,
      values: ['block', 'allow'],
      defaultDecisions: { block: 'block', allow: 'allow' },
    });
  });

  it('defaults an unrecognized label value to skip', () => {
    const preview: HubDatasetPreview = {
      ...PREVIEW,
      label_values: ['positive', 'negative'],
    };

    expect(previewToDistinctValues(preview)).toEqual({
      ok: true,
      values: ['positive', 'negative'],
      defaultDecisions: { positive: 'skip', negative: 'skip' },
    });
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
      // "Block" and "block" collapse to the same normalized key; insertion
      // order means the second entry (allow) wins - documents the
      // last-write-wins contract described on buildImportRequest.
      valueDecisions: { Block: 'block', block: 'allow' },
      assumeLabel: null,
    });

    expect(result.label_values).toEqual({ block: 'allow' });
  });

  it('includes assume_label when no label column is mapped', () => {
    const result = buildImportRequest({
      identity: IDENTITY,
      textColumn: 'prompt',
      labelColumn: null,
      valueDecisions: {},
      assumeLabel: 'allow',
    });

    expect(result.assume_label).toBe('allow');
    expect(result.label_column).toBeUndefined();
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
