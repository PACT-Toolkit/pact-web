import { describe, expect, it } from 'vitest';

import { pipelineStageLabel } from '@/src/framework/decisions/pipeline_stage';

describe('pipelineStageLabel', () => {
  it('labels every known stage and leaves an unknown id undefined', () => {
    expect(pipelineStageLabel('filter')).toBe('Filter');
    expect(pipelineStageLabel('classifier')).toBe('Classifier');
    expect(pipelineStageLabel('sentinel')).toBeUndefined();
    expect(pipelineStageLabel('constructor')).toBeUndefined();
  });
});
