import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { BenchmarkImportCard } from '@/src/app/benchmark/ui/BenchmarkImportCard';

// jsdom has no layout engine, so Radix Select's pointer-capture and
// scroll-into-view calls (used to manage its open/positioned state) throw
// without these - a standard shim for testing Radix's Select in jsdom, not
// specific to this component.
beforeAll(() => {
  window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

const renderCard = () =>
  render(
    (
      <SWRTestProvider>
        <BenchmarkImportCard
          onSubmit={vi.fn()}
          isSubmitting={false}
          disabled={false}
        />
      </SWRTestProvider>
    ) as ReactNode
  );

const inspect = async (slug: string) => {
  fireEvent.change(screen.getByTestId('benchmark-import-slug'), {
    target: { value: slug },
  });
  fireEvent.click(screen.getByTestId('benchmark-import-inspect'));
  await waitFor(() =>
    expect(
      screen.getByTestId('benchmark-import-preview-summary')
    ).toBeInTheDocument()
  );
};

describe('BenchmarkImportCard', () => {
  it('keeps Run disabled and shows the required hint when no text column is detected', async () => {
    renderCard();
    await inspect('Abirate/english_quotes');

    expect(
      screen.getByTestId('benchmark-import-text-column-hint')
    ).toHaveTextContent(
      'No text column detected - pick the column that holds the prompt text before running.'
    );
    expect(screen.getByTestId('benchmark-import-run')).toBeDisabled();
  });

  it('enables Run once a text column is picked by hand', async () => {
    renderCard();
    await inspect('Abirate/english_quotes');

    expect(screen.getByTestId('benchmark-import-run')).toBeDisabled();

    fireEvent.click(screen.getByTestId('benchmark-upload-mapping-text-column'));
    fireEvent.click(await screen.findByRole('option', { name: 'quote' }));

    expect(
      screen.queryByTestId('benchmark-import-text-column-hint')
    ).not.toBeInTheDocument();
    // No label column either, so Run stays gated behind the assume-label
    // control - pick one to isolate the text-column requirement.
    fireEvent.click(screen.getByTestId('benchmark-import-assume-label'));
    fireEvent.click(
      await screen.findByRole('option', { name: 'Allow (benign)' })
    );

    expect(screen.getByTestId('benchmark-import-run')).toBeEnabled();
  });

  it('keeps Run enabled with the normal detected-column dataset', async () => {
    renderCard();
    await inspect('deepset/prompt-injections');

    expect(
      screen.queryByTestId('benchmark-import-text-column-hint')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('benchmark-import-run')).toBeEnabled();
  });

  it('never logs the uncontrolled-to-controlled warning when a column is picked', async () => {
    // Radix's Select emits this one via console.warn (not console.error) -
    // see @radix-ui's useControllableState. Keep both spies: warn is the one
    // that actually fires for a Select outside a <form>, but a regression
    // that somehow routed it through error should still be caught.
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    renderCard();
    await inspect('Abirate/english_quotes');

    fireEvent.click(screen.getByTestId('benchmark-upload-mapping-text-column'));
    fireEvent.click(await screen.findByRole('option', { name: 'quote' }));

    const isUncontrolledWarning = ([message]: unknown[]) =>
      typeof message === 'string' &&
      message.includes('changing from uncontrolled to controlled');

    expect(consoleWarnSpy.mock.calls.filter(isUncontrolledWarning)).toEqual([]);
    expect(consoleErrorSpy.mock.calls.filter(isUncontrolledWarning)).toEqual(
      []
    );

    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
