import { expect, test } from '@playwright/test';

import { makeAxeBuilder } from '../../../../playwright/axe-fixture';

// PACT-924: the presigned upload target (mock-object-storage.local) is now
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
      buffer: Buffer.from('hello from PACT-924'),
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

  test('has no accessibility violations', async ({ page }) => {
    const results = await makeAxeBuilder(page).analyze();
    expect(results.violations).toEqual([]);
  });
});
