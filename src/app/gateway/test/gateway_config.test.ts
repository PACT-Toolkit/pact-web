import { describe, expect, it } from 'vitest';

import {
  consensusThresholdLabel,
  enforceModeLabel,
  isEnforcing,
  requestTimeoutLabel,
  sandboxIsolationLabel,
  spotlightFormatLabel,
} from '@/src/app/gateway/domain/gateway_config';

describe('isEnforcing', () => {
  it('is true only for "enforce"', () => {
    expect(isEnforcing('enforce')).toBe(true);
  });

  it.each(['shadow', undefined, '', 'unknown'])('is false for %s', (mode) => {
    expect(isEnforcing(mode)).toBe(false);
  });
});

describe('enforceModeLabel', () => {
  it('renders known modes', () => {
    expect(enforceModeLabel('enforce')).toBe('Enforce');
    expect(enforceModeLabel('shadow')).toBe('Shadow');
  });

  it('passes through an unrecognised mode rather than hiding it', () => {
    expect(enforceModeLabel('canary')).toBe('canary');
  });

  it('falls back to Unknown when absent', () => {
    expect(enforceModeLabel(undefined)).toBe('Unknown');
  });
});

describe('consensusThresholdLabel', () => {
  it('formats a 0-1 score as a whole percentage', () => {
    expect(consensusThresholdLabel(0.55)).toBe('55%');
  });

  it('renders a placeholder when absent', () => {
    expect(consensusThresholdLabel(undefined)).toBe('--');
  });
});

describe('sandboxIsolationLabel', () => {
  it('expands the two documented isolation levels', () => {
    expect(sandboxIsolationLabel('none')).toBe('None (plain process)');
    expect(sandboxIsolationLabel('namespace')).toBe(
      'Namespace (user+mount, /proc masked)'
    );
  });

  it('passes through an unrecognised isolation level', () => {
    expect(sandboxIsolationLabel('gvisor')).toBe('gvisor');
  });
});

describe('spotlightFormatLabel', () => {
  it('expands the three documented marker formats', () => {
    expect(spotlightFormatLabel('delim')).toBe('Delimiter markers');
    expect(spotlightFormatLabel('xml')).toBe('XML tags');
    expect(spotlightFormatLabel('json')).toBe('JSON envelope');
  });
});

describe('requestTimeoutLabel', () => {
  it('appends the seconds unit', () => {
    expect(requestTimeoutLabel(30)).toBe('30s');
  });

  it('renders a placeholder when absent', () => {
    expect(requestTimeoutLabel(undefined)).toBe('--');
  });
});
