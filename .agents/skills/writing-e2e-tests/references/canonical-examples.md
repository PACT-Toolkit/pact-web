# Canonical Spec Examples

Load this when starting a new spec and you want to model it on an exemplary existing one. Pick the closest match, read it end-to-end, then adapt.

## Existing specs (read these)

| Spec | What to learn from it |
| ---- | --------------------- |
| `e2e/mfa-totp.spec.ts` | **Current gold standard** — multi-step real-backend flow, deterministic Postgres seeding in `beforeEach`, in-process TOTP code generation, helper function extraction (`enrollTotpFromSettings`), `getByRole` + `getByTestId` locators, recovery-code round-trip assertion. |

## Planned specs (write these next)

These specs don't exist yet. When writing one, read the existing spec above for structure, then apply the patterns from the relevant reference files.

| Spec (to create) | Feature reference | Patterns to apply |
| ---------------- | ----------------- | ----------------- |
| `src/app/files/test/files_upload.spec.ts` | `/files` — upload, poll-to-ready, download link, delete | `recipes.md` (file upload + `setInputFiles`), `fake-clock.md` (poll loop), `accessibility.md` (axe on ready state) |
| `src/app/test_lab/test/test_lab.spec.ts` | `/test-lab` — submit prompt, live pipeline stages, block/allow result | `mocks.md` (MSW for `/v1/check` response), `aria-gotchas.md` (badge `data-state` assertions), `accessibility.md` |
| `src/app/audit/test/audit.spec.ts` | `/audit` — topic filter, row expand, classifier insight display | `aria-gotchas.md` (`aria-expanded` on collapsible rows), `recipes.md` (select/filter interactions), `accessibility.md` |
| `src/app/filter/test/filter.spec.ts` | `/filter` — decision list, stat cards, search | `recipes.md` (search input + result assertions), `accessibility.md` |
| `src/app/auth/test/login.spec.ts` | `/login` → `/dashboard` happy path in mock mode | `mocks.md` (MSW auto-login), `recipes.md` (form validation), `accessibility.md` |
