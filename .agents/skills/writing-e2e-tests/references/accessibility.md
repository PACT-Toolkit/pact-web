# Accessibility Testing — Deep Reference

Load this when adding or debugging `makeAxeBuilder` a11y tests.

## Coverage rule

One a11y test per **distinct view/route**. Discover all routes for a feature under `app/[locale]/(authenticated)/{feature}/`. Treat axe violations as **blocking**, not informational.

## Use the shared fixture

Always import the project's `makeAxeBuilder` — do **not** install `@axe-core/playwright` directly, and do **not** call `.disableRules()` per-test:

```ts
import { makeAxeBuilder } from '../../../../playwright/axe-fixture';

test('Should pass accessibility test', async ({ page }) => {
  const results = await makeAxeBuilder(page).analyze();
  expect(results.violations).toEqual([]);
});
```

Per-test `.disableRules()` overrides the global allow-list instead of appending to it, so it silently re-enables rules the project has disabled. Always go through the fixture.

## Secondary views

For a11y on a non-default view, navigate first and assert the destination rendered before analyzing — analyzing mid-transition produces flaky results:

```ts
test('Should pass a11y on create', async ({ page }) => {
  await page.getByTestId('create-button').click();
  await expect(page.getByTestId('create-form')).toBeVisible();
  const results = await makeAxeBuilder(page).analyze();
  expect(results.violations).toEqual([]);
});
```

## Pre-existing violations

If a violation is caused by a shared component you don't own, add the rule to `playwright/axe-fixture.ts` globally **and** create a Linear issue on team Void to track the underlying fix. Do not silence it locally in the spec.
