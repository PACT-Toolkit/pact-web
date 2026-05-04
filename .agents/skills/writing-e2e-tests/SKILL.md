---
name: writing-e2e-tests
description: "Write E2E tests with Playwright. Use when asked to 'add e2e tests', 'write e2e tests', or when creating *.spec.ts E2E files. NOT for unit tests (use writing-unit-tests)."
---

# Writing E2E Tests (Playwright)

Zero custom commands — standard Playwright APIs only.

## The bar

E2E tests are the load-bearing safety net that lets future AI agents ship feature changes without breaking user flows. Hold every spec to this bar:

- **Every acceptance criterion → at least one assertion.** If the brief lists three things the flow must do, the spec proves all three — not just that the page rendered.
- **Cover the branches the user actually hits.** Happy path is mandatory; loading, empty, error, and denied states get coverage if the feature has them. Happy-path-only specs are insufficient for non-trivial features.
- **Bug fixes require a regression spec.** Failing pre-fix, passing post-fix — both states confirmed. Without it, the bug is deferred.
- **Future-agent test:** ask _"if a future agent refactors the implementation and accidentally breaks the user-visible flow, would this spec fail loudly?"_ If "maybe" or "only on URL change," strengthen the assertions (see the testid-vs-content rule below — the canonical example).
- **No flake.** No `setTimeout` waits — Playwright's auto-waiting + explicit assertions only. No order-dependent state. Pin any date / time inputs. Each spec independent.
- **A11y per distinct view.** One `makeAxeBuilder(page).analyze()` per route. Treat violations as blocking, not informational.
- **No transport assertions.** Never assert on REST requests — see "Key Rules" below.

## File location

`src/app/{feature}/test/{feature}.spec.ts`

## The #1 rule: select by testid, assert on content

**Never use text to find elements. Always use text to verify content.**

A test that only checks `toHaveURL()` or `toBeVisible()` will pass on a 404 page. This has caused real false-positive test passes when routes were moved.

```ts
// ❌ DANGEROUS — passes on a 404 page
await page.getByTestId('benefit-link-123').click();
await expect(page).toHaveURL(/\/benefits\/123/);

// ✅ SAFE — proves the page loaded with real data
await page.getByTestId('benefit-link-123').click();
await expect(page.getByTestId('benefit-detail-name')).toContainText('Expected Name');
```

**After every navigation**, assert on **rendered text content** — not just URL or visibility.

### Selector rules

- `getByTestId()` is primary — prefer stable test IDs over text which can change.
- `getByText()` — ONLY for select-dropdown option text, never for finding page elements.

## `data-testid` naming

`kebab-case`, feature-prefixed: `{feature}-{component}-{element}`.

```
✅ policy-detail-approve-button
✅ classifier-results-list
❌ approveBtn
❌ list
```

**Never add wrapper elements just to host a `data-testid`.** Add test IDs to elements that already exist in the DOM.

## Test structure

```ts
import { expect, test } from '@playwright/test';

import { makeAxeBuilder } from '../../../../playwright/axe-fixture';

test.describe('Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/feature');
    await expect(page.getByTestId('feature-view')).toBeVisible();
  });

  test('Should display data', async ({ page }) => {
    await expect(page.getByTestId('feature-item').first()).toContainText('Expected Data');
  });

  test('Should pass accessibility test', async ({ page }) => {
    const results = await makeAxeBuilder(page).analyze();
    expect(results.violations).toEqual([]);
  });
});
```

## Mock setup

Use MSW handlers in `src/app/{feature}/mock/handlers/` to control API responses per test. Import mock fixtures from `src/app/{feature}/mock/data/` for consistent test data.

## What to assert on (priority order)

1. **Data from API/mock** — if data flows through to the UI, assert on that. Proves the pipeline works and survives transport-layer changes.
2. **Localization strings** — if a component only renders translations (no dynamic data), assert on those to prove the right component rendered.

```ts
// ✅ Dialog has data — assert on data
await expect(dialog).toContainText('+4544204475');     // phone from mock
await expect(dialog).toContainText('cowins@cowins.dk'); // email from mock

// ✅ Card has no dynamic data — assert on translations
await expect(card).toContainText('Travel Insurance');
await expect(card).toContainText('Conditions');
```

## Key rules

- **No network assertions.** Never intercept/assert on REST requests; tests must not know the transport layer.
- **Test both dismiss and confirm paths** for dialogs.
- **Respect existing component structure** — see `data-testid` naming above.

## Progressive disclosure — load on demand

These references stay out of the agent's context until the relevant trigger appears. Open the file when its trigger fires, not preemptively.

| Read this | When |
| --------- | ---- |
| [`references/accessibility.md`](references/accessibility.md) | Adding `makeAxeBuilder` tests, debugging axe violations, or covering multiple views with a11y. |
| [`references/aria-gotchas.md`](references/aria-gotchas.md) | Asserting on ARIA state attributes (`aria-disabled`, `aria-pressed`, `aria-invalid`, `aria-checked`), or working with shadcn/ui / Radix primitives. |
| [`references/fake-clock.md`](references/fake-clock.md) | Reaching for `page.clock.runFor` / `fastForward`, or testing a polling loop that mixes `await` calls with sleep timers. |
| [`references/mocks.md`](references/mocks.md) | Wiring a spec against MSW mocks, importing mock IDs / enums, or considering a per-test mock override. |
| [`references/recipes.md`](references/recipes.md) | Form-validation errors (`aria-errormessage`), date pickers (`rdp-day_button`), file uploads, or extracting dynamic IDs from `data-testid` prefixes. |
| [`references/canonical-examples.md`](references/canonical-examples.md) | Starting a new spec and you want to model it on an exemplary existing one. |
