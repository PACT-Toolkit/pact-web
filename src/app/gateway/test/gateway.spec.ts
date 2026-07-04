import { expect, test } from '@playwright/test';

import { makeAxeBuilder } from '../../../../playwright/axe-fixture';

// Covers PACT-327: /gateway control panel exposing the gateway's live
// behavior across four read-only sections.
//
// - GatewayEnforcementPanel reads GET /v1/config (pact-gateway PACT-320,
//   PR #88): classifier/vector enforce mode, consensus threshold, sandbox
//   enabled/isolation, diagnostics enabled, spotlight format, request
//   timeout. The shadow<->enforce toggle is explicitly out of scope (noted
//   follow-on in the issue) -- this console is read-only.
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
