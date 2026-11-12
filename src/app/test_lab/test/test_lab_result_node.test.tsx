import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TestLabResultNode } from '@/src/app/test_lab/ui/TestLabResultNode';

const renderNode = (reason: string) =>
  render(
    <TestLabResultNode
      decision="block"
      reason={reason}
      onSave={() => undefined}
      saveState="idle"
    />
  );

describe('TestLabResultNode reason code wrapping', () => {
  it('keeps the reason text intact and offers a break only after each underscore', () => {
    renderNode('classifier_input_too_large');

    const reasonEl = screen.getByText('classifier_input_too_large');
    expect(reasonEl.textContent).toBe('classifier_input_too_large');
    expect(reasonEl.querySelectorAll('wbr')).toHaveLength(3);
    expect(reasonEl.innerHTML).toBe(
      'classifier_<wbr>input_<wbr>too_<wbr>large'
    );
  });

  it('adds no break opportunity to a reason without underscores', () => {
    renderNode('blocked');

    expect(screen.getByText('blocked').querySelectorAll('wbr')).toHaveLength(0);
  });
});
