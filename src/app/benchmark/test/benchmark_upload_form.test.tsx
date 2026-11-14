import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BenchmarkUploadForm } from '@/src/app/benchmark/ui/BenchmarkUploadForm';

const renderForm = () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <BenchmarkUploadForm
      onSubmit={onSubmit}
      isSubmitting={false}
      disabled={false}
    />
  );

  return onSubmit;
};

const uploadCorpus = async () => {
  const file = new File(
    ['{"content":"hello","expected_label":"allow"}\n'],
    'corpus.jsonl',
    { type: 'application/x-ndjson' }
  );
  fireEvent.change(screen.getByLabelText(/corpus file/i), {
    target: { files: [file] },
  });
  await waitFor(() =>
    expect(screen.getByTestId('benchmark-upload-submit')).toBeEnabled()
  );
};

describe('BenchmarkUploadForm ablation option', () => {
  it('is off by default and explains itself', () => {
    renderForm();

    const option = screen.getByRole('switch', { name: 'Ablation' });

    expect(option).not.toBeChecked();
    expect(option).toHaveAccessibleDescription(
      'Runs every row once in evidence mode and derives the seven defense configurations. Latencies are estimated.'
    );
  });

  it('submits with ablation off by default', async () => {
    const onSubmit = renderForm();
    await uploadCorpus();

    fireEvent.click(screen.getByTestId('benchmark-upload-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][1]).toEqual({ ablation: false });
  });

  it('submits with ablation on once the option is switched on', async () => {
    const onSubmit = renderForm();
    await uploadCorpus();

    fireEvent.click(screen.getByRole('switch', { name: 'Ablation' }));
    fireEvent.click(screen.getByTestId('benchmark-upload-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][1]).toEqual({ ablation: true });
  });
});
