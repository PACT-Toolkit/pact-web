import { describe, expect, it } from 'vitest';

import { buildLabel } from '@/src/framework/format/build_label';

// PACT-916 review fix: the dashboard widget previously hid the whole Build
// row whenever gateway_version was "unknown", which also threw away the
// engine - the more valuable half of the label. buildLabel always keeps
// the engine and only appends the gateway version when it's a real value.
// Moved from dashboard/domain to framework/format for PACT-927, once the
// benchmark trend chart tooltip became a second call site.
describe('buildLabel', () => {
  it('appends the gateway version when it is set', () => {
    expect(buildLabel('deberta', 'v1.2.3')).toBe('deberta · v1.2.3');
  });

  it('omits the gateway version when it is the literal string "unknown"', () => {
    expect(buildLabel('deberta', 'unknown')).toBe('deberta');
  });

  it('omits the gateway version case-insensitively', () => {
    expect(buildLabel('deberta', 'Unknown')).toBe('deberta');
  });

  it('omits the gateway version when it is an empty string', () => {
    expect(buildLabel('deberta', '')).toBe('deberta');
  });
});
