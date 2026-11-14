import { expect, test } from '@playwright/test';

import { makeAxeBuilder } from '../../../../playwright/axe-fixture';

// The presigned upload target (mock-object-storage.local) is now
// answered by the global files MSW handlers, so a real click-through upload
// completes end to end in dev:mock instead of hanging on the PUT step.
test.describe('Files workbench', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/files');
    await expect(page.getByTestId('files-workbench')).toBeVisible();
    await expect(page.getByTestId('files-row').first()).toBeVisible();
  });

  test('uploading a file through the picker completes and reaches ready', async ({
    page,
  }) => {
    const fileName = 'pact-924-upload-test.txt';

    await page.getByTestId('files-upload-input').setInputFiles({
      name: fileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('hello from the upload test'),
    });

    const newRow = page.getByTestId('files-row').filter({ hasText: fileName });
    await expect(newRow).toBeVisible();

    // The upload starts "processing" once confirmed, then the mock pipeline
    // settles it to "ready" after a few seconds (see mock/handlers/files.ts
    // settle()) - the row list polls every POLL_INTERVAL_MS while anything
    // is non-terminal, so this proves the full presign -> PUT -> confirm ->
    // poll-to-ready loop actually completes rather than getting stuck.
    await expect(newRow.getByTestId('files-row-status')).toHaveText('ready', {
      timeout: 10_000,
    });
  });

  test('a blocked file shows its verdict and withholds the download', async ({
    page,
  }) => {
    const row = page
      .getByTestId('files-row')
      .filter({ hasText: 'oversize-prompt.txt' });

    await expect(row.getByTestId('files-row-scan')).toHaveText(/Blocked/);
    await expect(row.getByTestId('files-row-scan-detail')).toHaveText(
      "Classifier: Input exceeds the classifier's size limit - fail closed"
    );
    await expect(row.getByTestId('files-row-download-withheld')).toBeVisible();
    await expect(row.getByRole('link', { name: 'Download' })).toHaveCount(0);
    await expect(row.getByText(/lookup failed|network error/)).toHaveCount(0);
  });

  test('a scanning file turns into passed without a reload', async ({
    page,
  }) => {
    const row = page
      .getByTestId('files-row')
      .filter({ hasText: 'research-draft.md' });

    await expect(row.getByTestId('files-row-scan')).toHaveText(/Scanning/);
    await expect(row.getByTestId('files-row-scan')).toHaveText(/Scan passed/, {
      timeout: 40_000,
    });
  });

  test('has no accessibility violations', async ({ page }) => {
    const results = await makeAxeBuilder(page).analyze();
    expect(results.violations).toEqual([]);
  });
});
