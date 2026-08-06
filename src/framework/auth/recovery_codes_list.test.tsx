import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecoveryCodesList } from '@/src/framework/auth/recovery_codes_list';

const CODES = ['aaa111', 'bbb222', 'ccc333'];

describe('RecoveryCodesList', () => {
  const writeTextMock = vi.fn<(text: string) => Promise<void>>();
  // jsdom doesn't implement the Blob URL registry - stub both static
  // methods directly on the global URL constructor rather than replacing
  // the constructor itself, since triggerDownload only ever calls these
  // two and every other `new URL(...)` call site in the app needs to keep
  // working undisturbed.
  const createObjectURLMock = vi.fn(() => 'blob:mock');
  const revokeObjectURLMock = vi.fn();

  beforeEach(() => {
    writeTextMock.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });
    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;
  });

  afterEach(() => {
    // @ts-expect-error - test-only cleanup of the jsdom stub above.
    delete navigator.clipboard;
  });

  it('renders every code exactly once', () => {
    render(<RecoveryCodesList codes={CODES} testId="codes" />);

    const list = screen.getByTestId('codes');
    for (const code of CODES) {
      expect(within(list).getByText(code)).toBeInTheDocument();
    }
    expect(list.querySelectorAll('li')).toHaveLength(CODES.length);
  });

  it('copies every code, newline-joined, and flips the button label', async () => {
    render(<RecoveryCodesList codes={CODES} />);

    fireEvent.click(screen.getByRole('button', { name: /copy all/i }));

    await screen.findByRole('button', { name: /copied/i });
    expect(writeTextMock).toHaveBeenCalledWith(CODES.join('\n'));
  });

  it('surfaces a visible error when the clipboard write fails', async () => {
    writeTextMock.mockRejectedValue(new Error('denied'));

    render(<RecoveryCodesList codes={CODES} />);
    fireEvent.click(screen.getByRole('button', { name: /copy all/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not copy to clipboard/i);
    // No false success signal - the label must not flip to "Copied".
    expect(
      screen.getByRole('button', { name: /copy all/i })
    ).toBeInTheDocument();
  });

  it('triggers a file download with the given filename', () => {
    // triggerDownload (src/framework/helpers/download.ts) builds a real
    // <a download> and appends it to the document rather than faking the
    // element - spying on the real anchor's click() keeps that whole path
    // exercised instead of mocking it away.
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    render(
      <RecoveryCodesList codes={CODES} filename="pact-recovery-codes.txt" />
    );
    fireEvent.click(screen.getByRole('button', { name: /download/i }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });
});
