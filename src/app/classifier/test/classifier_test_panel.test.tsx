import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { ClassifierTestPanel } from '@/src/app/classifier/ui/ClassifierTestPanel';

const renderPanel = () =>
  render(
    (
      <SWRTestProvider>
        <ClassifierTestPanel />
      </SWRTestProvider>
    ) as ReactNode
  );

describe('ClassifierTestPanel - input_too_large', () => {
  it('shows the size message for a 413, not a generic failure', async () => {
    renderPanel();
    fireEvent.change(screen.getByTestId('classifier-test-input'), {
      target: { value: 'a'.repeat(50_000) },
    });
    fireEvent.click(screen.getByTestId('classifier-test-run'));

    expect(
      await screen.findByTestId('classifier-test-input-too-large')
    ).toHaveTextContent('Input too large: 50,000 bytes, limit 40,573 bytes');
    expect(
      screen.queryByTestId('classifier-test-error')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('classifier-test-result')
    ).not.toBeInTheDocument();
  });
});
