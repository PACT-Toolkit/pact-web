import { expect, test } from '@playwright/test';

import { makeAxeBuilder } from '../../../../playwright/axe-fixture';

// Covers PACT-327 (read-only sandbox/diagnostics/spotlight probes) and
// PACT-473 (live shadow/enforce toggles on the enforcement panel).
//
// - GatewayEnforcementPanel reads GET /v1/config (pact-gateway PACT-320,
//   PR #88) and writes classifier/vector enforce mode + consensus mode
//   through PATCH /v1/config/enforcement (pact-gateway PACT-472) via
//   GatewayEnforcementControls's segmented controls -- see that component's
//   docblock. classifierEnforceMode/vectorEnforceMode only ever take
//   "shadow"/"enforce" (no "off"); consensusMode takes "inline"/"shadow".
// - GatewaySandboxPanel/GatewayDiagnosticsPanel/GatewaySpotlightPanel each
//   run an ad-hoc /v1/check probe (same shape as ClassifierTestPanel /
//   RedactorTestPanel) since their fields (purified_content, causal_spans,
//   wrapped chunk markers) are either response-only or excluded from the
//   pact.decisions audit feed by design -- see each domain file's docblock.
test.describe('Gateway console', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/gateway');
    await expect(page.getByTestId('gateway-enforcement-panel')).toBeVisible();
    await expect(page.getByTestId('gateway-config-grid')).toBeVisible();
  });

  test('renders the live enforcement posture from GET /v1/config', async ({
    page,
  }) => {
    const grid = page.getByTestId('gateway-config-grid');
    await expect(grid).toContainText('Enforce');
    await expect(grid).toContainText('55%');
    await expect(grid).toContainText('Enabled');
    await expect(grid).toContainText('Namespace');
    await expect(grid).toContainText('XML tags');
    await expect(grid).toContainText('30s');
  });

  test('refresh button on the enforcement panel revalidates the config', async ({
    page,
  }) => {
    const panel = page.getByTestId('gateway-enforcement-panel');
    const refreshButton = panel.getByRole('button', { name: 'Refresh' });
    await expect(refreshButton).toBeEnabled();
    await refreshButton.click();
    await expect(page.getByTestId('gateway-config-grid')).toBeVisible();
  });

  test('renders the non-persistence caveat for the runtime enforcement controls', async ({
    page,
  }) => {
    const footer = page.getByTestId('gateway-enforcement-controls-footer');
    await expect(footer).toContainText('gateway restart resets these to');
  });

  test('flipping consensus mode to shadow applies immediately with no confirmation', async ({
    page,
  }) => {
    const consensusControl = page.getByTestId('gateway-consensus-mode-control');
    await expect(
      consensusControl.getByRole('radio', { name: 'Inline' })
    ).toHaveAttribute('aria-checked', 'true');

    await consensusControl.getByRole('radio', { name: 'Shadow' }).click();

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(
      consensusControl.getByRole('radio', { name: 'Shadow' })
    ).toHaveAttribute('aria-checked', 'true');
  });

  test('flipping classifier mode to enforce requires confirmation, and cancel leaves it unchanged', async ({
    page,
  }) => {
    // Mock-mode default seeds classifierEnforceMode: 'enforce' already, so
    // flip to shadow first to exercise the "currently enforce -> shadow ->
    // back to enforce" round trip against a known starting value.
    const classifierControl = page.getByTestId(
      'gateway-classifier-mode-control'
    );
    await classifierControl.getByRole('radio', { name: 'Shadow' }).click();
    await expect(
      classifierControl.getByRole('radio', { name: 'Shadow' })
    ).toHaveAttribute('aria-checked', 'true');

    await classifierControl.getByRole('radio', { name: 'Enforce' }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Classifier enforcement');
    await expect(dialog).toContainText('Shadow');
    await expect(dialog).toContainText('Enforce');

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      classifierControl.getByRole('radio', { name: 'Shadow' })
    ).toHaveAttribute('aria-checked', 'true');
  });

  test('confirming the enforce flip applies the change and survives a poll cycle', async ({
    page,
  }) => {
    const vectorControl = page.getByTestId('gateway-vector-mode-control');
    await vectorControl.getByRole('radio', { name: 'Shadow' }).click();
    await expect(
      vectorControl.getByRole('radio', { name: 'Shadow' })
    ).toHaveAttribute('aria-checked', 'true');

    await vectorControl.getByRole('radio', { name: 'Enforce' }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Switch to Enforce' }).click();
    await expect(dialog).toHaveCount(0);

    await expect(
      vectorControl.getByRole('radio', { name: 'Enforce' })
    ).toHaveAttribute('aria-checked', 'true');

    // Refresh (same request the 15s poll fires) to confirm the write is
    // reflected on the next GET /v1/config, not just the optimistic update.
    const refreshButton = page
      .getByTestId('gateway-enforcement-panel')
      .getByRole('button', { name: 'Refresh' });
    await refreshButton.click();
    await expect(
      vectorControl.getByRole('radio', { name: 'Enforce' })
    ).toHaveAttribute('aria-checked', 'true');
  });

  test('sandbox panel probe surfaces at least one hostile external_ref verdict', async ({
    page,
  }) => {
    await page.getByTestId('gateway-sandbox-run').click();
    const result = page.getByTestId('gateway-sandbox-result');
    await expect(result).toBeVisible();

    const rows = page.getByTestId('gateway-sandbox-ref-row');
    await expect(rows).toHaveCount(2);
    await expect(result).toContainText('HOSTILE');
  });

  test('diagnostics panel probe blocks and highlights the causal span', async ({
    page,
  }) => {
    await page.getByTestId('gateway-diagnostics-run').click();
    const result = page.getByTestId('gateway-diagnostics-result');
    await expect(result).toBeVisible();
    await expect(result).toContainText('BLOCK');
    await expect(page.getByTestId('gateway-diagnostics-span')).toBeVisible();
  });

  test('spotlight panel probe wraps a trusted and an untrusted chunk', async ({
    page,
  }) => {
    await page.getByTestId('gateway-spotlight-run').click();
    const result = page.getByTestId('gateway-spotlight-result');
    await expect(result).toBeVisible();

    const rows = page.getByTestId('gateway-spotlight-chunk-row');
    await expect(rows).toHaveCount(2);
    await expect(result).toContainText('TRUSTED');
    await expect(result).toContainText('UNTRUSTED');
    await expect(result).toContainText('xml');
  });

  test('has no accessibility violations', async ({ page }) => {
    const results = await makeAxeBuilder(page).analyze();
    // Pre-existing app-shell landmark issues, not introduced by PACT-327 --
    // same filter already applied in classifier.spec.ts / redactor.spec.ts /
    // policy.spec.ts / consensus.spec.ts. Remove once the shell is fixed.
    const SHELL_A11Y_FOLLOW_UP = new Set([
      'landmark-no-duplicate-main',
      'landmark-unique',
      'landmark-main-is-top-level',
      'region',
    ]);
    const violations = results.violations.filter(
      (violation) => !SHELL_A11Y_FOLLOW_UP.has(violation.id)
    );
    expect(violations).toEqual([]);
  });
});
