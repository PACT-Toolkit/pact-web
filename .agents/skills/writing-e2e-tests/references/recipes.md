# Playwright Recipes — Codebase-Specific Patterns

Only patterns you can't derive from standard Playwright docs.

---

## Form Validation Errors (`aria-errormessage`)

This codebase links form errors via `aria-errormessage` attribute pointing to error element IDs:

```ts
await page.getByTestId('submit-button').click();

const field = page.locator('[name="fieldName"]');
await expect(field).toHaveAttribute('aria-errormessage', /.+/);
const errorId = await field.getAttribute('aria-errormessage');
await expect(page.locator(`[id="${errorId}"]`)).toBeVisible();
```

Multiple error IDs (space-separated):

```ts
const errorMsgId = await field.getAttribute('aria-errormessage');
const errorIds = errorMsgId?.split(/\s+/).filter(Boolean) ?? [];
await Promise.all(errorIds.map((id) => expect(page.locator(`#${id}`)).toBeVisible()));
```

---

## Date Pickers (react-day-picker)

The date picker renders days as `button.rdp-day_button` — use exact regex to avoid matching day 15 when clicking 1:

```ts
await page.clock.setFixedTime(new Date(Date.UTC(2021, 10, 20)));

await startDateInput.click();
await page.locator('button.rdp-day_button').filter({ hasText: /^15$/ }).first().click();
```

---

## File Upload Fixture Path

```ts
const fixturesDir = path.resolve(__dirname, '../../../../playwright/fixtures');
await page.getByTestId('dropzone').locator('input[type="file"]').setInputFiles(path.join(fixturesDir, 'test.jpg'));
```

---

## Prefix-Based TestId Selectors

Extract dynamic IDs from test attributes:

```ts
const links = page.locator('[data-testid^="benefit-link-"]');
const testId = await links.first().getAttribute('data-testid');
const id = testId?.replace('benefit-link-', '');
await expect(page.getByTestId(`benefit-name-${id}`)).toBeVisible();
```
