# Mocks — MSW Conventions and Imports

Load this when wiring a spec against mock data or considering a per-test mock override.

## Layout

- Mock data factories: `src/app/{feature}/mock/data/`
- MSW handlers: `src/app/{feature}/mock/handler/`
- Playwright file-upload fixtures: `playwright/fixtures/`

## Do NOT create test-specific mock overrides

Use the existing mock layer. If a spec needs a state the shared mocks don't cover, extend the shared mock so other specs benefit too — don't fork it inside the spec file.

## Importing mock data and types

Pull stable IDs and enum values from the same source the app and mock handlers use, so the spec moves in lock-step with the code:

```ts
import { savingsAccountId } from '@/src/app/account/mock/data/accounts';
import { CardType } from '@/src/__codegen__/types';

await page.getByTestId(`widget-item-${savingsAccountId}`).click();
await page.getByTestId(`card-type-${CardType.Virtual}`).click();
```

This survives mock-data refactors that hard-coded UUIDs would not.
