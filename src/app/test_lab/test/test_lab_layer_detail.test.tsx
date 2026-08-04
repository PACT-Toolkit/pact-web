import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TestLabLayerDetail } from '@/src/app/test_lab/ui/TestLabLayerDetail';
import { type LayerState } from '@/src/app/test_lab/ui/types';

const baseLayer = (over: Partial<LayerState> = {}): LayerState => ({
  id: 'filter',
  label: 'Filter',
  decision: 'block',
  ...over,
});

const renderDetail = (layer: LayerState) =>
  render(
    (
      <TestLabLayerDetail
        layer={layer}
        isRunning={false}
        onBlock={vi.fn()}
        onPassthrough={vi.fn()}
        onClose={vi.fn()}
      />
    ) as ReactNode
  );

describe('TestLabLayerDetail causal spans (PACT-745)', () => {
  it('lists offset ranges when causalSpans is present and non-empty', () => {
    renderDetail(
      baseLayer({
        ruleId: 'inject-003',
        causalSpans: [
          { start: 0, end: 11 },
          { start: 76, end: 94 },
        ],
      })
    );

    const spans = screen.getByTestId('test-lab-layer-causal-spans');
    expect(spans).toHaveTextContent('chars 0-11');
    expect(spans).toHaveTextContent('chars 76-94');
  });

  it('renders no causal-spans section when the field is absent (unchanged case)', () => {
    renderDetail(baseLayer({ ruleId: 'inject-003' }));

    expect(
      screen.queryByTestId('test-lab-layer-causal-spans')
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/causal spans/i)).not.toBeInTheDocument();
  });

  it('renders no causal-spans section when the array is empty', () => {
    renderDetail(baseLayer({ ruleId: 'inject-003', causalSpans: [] }));

    expect(
      screen.queryByTestId('test-lab-layer-causal-spans')
    ).not.toBeInTheDocument();
  });
});
