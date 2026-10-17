import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StageStrip } from '@/src/framework/decisions/stage_strip';

describe('StageStrip durations', () => {
  it('renders a rounded whole-ms label only for entries that carry a duration', () => {
    render(
      <StageStrip
        testId="strip"
        stages={[
          { id: 'filter', blocked: true, durationMs: 3.4 },
          { id: 'classifier', blocked: false },
        ]}
      />
    );

    expect(screen.getByTestId('stage-duration-filter')).toHaveTextContent(
      '3 ms'
    );
    expect(
      screen.queryByTestId('stage-duration-classifier')
    ).not.toBeInTheDocument();
  });
});
