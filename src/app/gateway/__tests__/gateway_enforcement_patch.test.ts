import { describe, expect, it } from 'vitest';

import {
  applyOptimisticEnforcementPatch,
  buildEnforcementPatch,
  consensusModeLabel,
  enforcementPatchErrorMessage,
  isFlipToEnforce,
  type EnforcementField,
} from '@/src/app/gateway/domain/gateway_enforcement_patch';

describe('isFlipToEnforce', () => {
  it.each<[EnforcementField, string]>([
    ['classifierEnforceMode', 'enforce'],
    ['vectorEnforceMode', 'enforce'],
  ])('is true for %s -> %s', (field, value) => {
    expect(isFlipToEnforce(field, value)).toBe(true);
  });

  it.each<[EnforcementField, string]>([
    ['classifierEnforceMode', 'shadow'],
    ['vectorEnforceMode', 'shadow'],
    ['consensusMode', 'inline'],
    ['consensusMode', 'shadow'],
  ])(
    'is false for %s -> %s (consensusMode never has an enforce value)',
    (field, value) => {
      expect(isFlipToEnforce(field, value)).toBe(false);
    }
  );
});

describe('buildEnforcementPatch', () => {
  it('sets only the field being changed', () => {
    expect(buildEnforcementPatch('classifierEnforceMode', 'enforce')).toEqual({
      classifierEnforceMode: 'enforce',
    });
    expect(buildEnforcementPatch('vectorEnforceMode', 'shadow')).toEqual({
      vectorEnforceMode: 'shadow',
    });
    expect(buildEnforcementPatch('consensusMode', 'shadow')).toEqual({
      consensusMode: 'shadow',
    });
  });

  it('never sets the other two fields, even to undefined', () => {
    const patch = buildEnforcementPatch('classifierEnforceMode', 'enforce');
    expect('vectorEnforceMode' in patch).toBe(false);
    expect('consensusMode' in patch).toBe(false);
  });
});

describe('consensusModeLabel', () => {
  it('renders known modes', () => {
    expect(consensusModeLabel('inline')).toBe('Inline');
    expect(consensusModeLabel('shadow')).toBe('Shadow');
  });

  it('passes through an unrecognised mode rather than hiding it', () => {
    expect(consensusModeLabel('canary')).toBe('canary');
  });

  it('falls back to Unknown when absent', () => {
    expect(consensusModeLabel(undefined)).toBe('Unknown');
  });
});

describe('applyOptimisticEnforcementPatch', () => {
  const okResponse = {
    data: {
      classifierEnforceMode: 'shadow',
      vectorEnforceMode: 'shadow',
      consensusMode: 'inline',
    },
    status: 200 as const,
    headers: new Headers(),
  };

  it('merges the patch onto a known-good 200 snapshot', () => {
    const result = applyOptimisticEnforcementPatch(okResponse, {
      classifierEnforceMode: 'enforce',
    });
    if (!result || result.status !== 200) {
      throw new Error('expected a 200 response');
    }

    expect(result.data.classifierEnforceMode).toBe('enforce');
    // Untouched fields survive the merge.
    expect(result.data.vectorEnforceMode).toBe('shadow');
    expect(result.data.consensusMode).toBe('inline');
  });

  it('leaves an error response untouched', () => {
    const errorResponse = {
      data: 'unauthorized',
      status: 401 as const,
      headers: new Headers(),
    };

    expect(
      applyOptimisticEnforcementPatch(errorResponse, {
        classifierEnforceMode: 'enforce',
      })
    ).toBe(errorResponse);
  });

  it('passes through undefined unchanged', () => {
    expect(
      applyOptimisticEnforcementPatch(undefined, {
        classifierEnforceMode: 'enforce',
      })
    ).toBeUndefined();
  });
});

describe('enforcementPatchErrorMessage', () => {
  it('calls out 403 as a permission failure', () => {
    expect(enforcementPatchErrorMessage(403)).toBe(
      'You do not have permission to change the enforcement mode.'
    );
  });

  it('calls out 400 as a rejected value', () => {
    expect(enforcementPatchErrorMessage(400)).toBe(
      'The gateway rejected that value.'
    );
  });

  it('falls back to a generic message with the status code for anything else', () => {
    expect(enforcementPatchErrorMessage(500)).toBe(
      'Failed to update enforcement mode (500).'
    );
  });
});
