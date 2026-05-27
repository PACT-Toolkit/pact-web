# AGENTS.md

Agent and AI-assistant guidance for PACT Web. For human onboarding, see [README.md](README.md).

> This file is the canonical source. `CLAUDE.md` is a symlink to it.

## Commands

```bash
# Development
pnpm run dev:mock       # Start dev server with MSW mocked data (most common)
pnpm run dev            # Start dev server against real backend

# Testing
pnpm run test           # Run unit tests (Vitest)
pnpm run test:watch     # Run unit tests in watch mode
pnpm run pw:open        # Open Playwright E2E UI
pnpm run pw:run         # Run E2E tests headless

# Linting & type-checking
pnpm run lint           # TypeScript check + ESLint (run both before committing)
pnpm run lint:typescript
pnpm run lint:eslint

# Code generation
pnpm api:update         # Fetch swagger specs + regenerate all REST hooks
pnpm rest:codegen       # Regenerate REST hooks only
```

To run a single Vitest test file: `TZ=CET vitest run src/app/my_feature/test/my_test.test.ts`

---

## Skills

Skills live in `.agents/skills/`. Each tool accesses them via its own symlink (e.g. `.cursor/skills/`, `.claude/skills/`).

When creating new skills, **always create them in `.agents/skills/{skill-name}/SKILL.md`**.

Available skills:

- `gitmoji` — pick the right gitmoji for a commit and write the subject in this repo's style (emoji + lowercase imperative); use when crafting commit messages
- `grill-me` — interview the user about an upcoming task until the spec is unambiguous; produces a confirmed plan, then stops (does not implement). Trigger with `/grill-me`
- `linear-plan` — scope and break down a feature into Linear tasks (planning, ticket creation, project setup)
- `next-best-practices` — Next.js conventions: file/route layout, RSC boundaries, data patterns, async APIs, metadata, error handling, route handlers, image/font optimization, bundling
- `pact-component-naming` — one component per file, feature-prefix naming (`TestLab*`, `Audit*`, etc.), sub-folder prefix concatenation, file-name ↔ export-name parity. Use when creating or renaming any component in pact-web.
- `pact-domain-layer` — what goes in `domain/` vs `ui/types.ts`: API payload types, business records, inference helpers, and domain constants belong in `domain/`; visual-state types stay in `ui/types.ts`. Use when adding any new type, helper, or constant to a feature.
- `pact-dev-mock` — how `pnpm run dev` and `pnpm run dev:mock` are separated: `isMock()` helper, MSW browser + Node bootstrap (`instrumentation.ts`), auto-login short-circuit, persona switching, OAuth bypass, `getApiBaseUrl()`, handler hygiene test. Use when touching auth, server-side fetch, mock plumbing, or anything env-conditional.
- `pact-mock-data` — per-feature mock layer conventions: `MockRepository<T>` + central `db`, `mock/data` vs `mock/handlers` split, feature-named files (`{feature}.ts` not `index.ts` in both directories), instantiator + `createXMockData(db)` seeder, glob-only handler URL patterns. Use when scaffolding a new feature mock or wiring a new MSW endpoint.
- `playwright-best-practices` — Playwright testing across E2E, component, API, visual, a11y, security, perf, Electron, and extensions; flaky-fix, POM, CI/CD, mocking, auth, tags
- `shadcn` — add, search, fix, style, and compose shadcn/ui components; registries, presets, project context, usage examples
- `swr-best-practices` — SWR for data fetching, mutations, revalidation, error handling, caching, subscriptions, middleware, Next.js integration
- `pact-react-patterns` — SWR-first data fetching (never fetch in `useEffect`), optimistic updates via SWR, derived state over `useEffect` sync, polling via `refreshInterval`. Use when writing or reviewing any component that fetches data or has effects.
- `tailwind-design-system` — build scalable design systems with Tailwind CSS v4: design tokens, component libraries, responsive patterns
- `typescript-advanced-types` — generics, conditional types, mapped types, template literals, utility types
- `vercel-react-best-practices` — React/Next.js performance guidelines from Vercel Engineering: components, data fetching, bundle optimization
- `web-design-guidelines` — review UI code against the Web Interface Guidelines (a11y, UX, design polish)
- `writing-e2e-tests` — write Playwright E2E tests using standard APIs (no custom helpers); for `*.spec.ts` files
- `writing-unit-tests` — write Vitest unit tests using standard APIs (no custom helpers); for `*.test.ts` files

> Skills are kept in sync across tools by symlinking — `.cursor/skills` and `.claude/skills` both point at `.agents/skills`. To list what is actually installed locally, run `ls .agents/skills`.

---

## Architecture

PACT Web is a Next.js 16 app (React 18) using **pnpm** as the package manager.

### Module Hierarchy (ESLint-enforced)

```
pages → app → framework
              ↓
           contexts
```

| From        | Can Import                     |
| ----------- | ------------------------------ |
| `app`       | `app`, `contexts`, `framework` |
| `contexts`  | `contexts`, `framework`        |
| `framework` | `framework` only               |
| `pages`     | `app` only                     |

**Forbidden:**

- `contexts` → `app` (contexts cannot depend on features)
- `framework` → `app`, `contexts` (framework is the lowest level)
- `app` → `pages` (features don't know about routing)

### Path Aliases

Always use the `@/` alias for absolute imports (maps to repo root).
Example: `import { foo } from '@/src/app/feature/domain/foo'`

---

## Feature Folder Structure

Every feature lives in `src/app/{feature_name}/`:

```
src/app/{feature}/
├── data/                    # Data layer
│   └── __codegen__/         # Auto-generated REST hooks (DO NOT EDIT)
├── domain/                  # Business logic
│   ├── *_context.tsx        # React contexts
│   └── *_validation_schema.ts
├── mock/                    # MSW mocking
│   ├── data/                # Mock data factories
│   └── handlers/            # MSW request handlers
├── test/                    # E2E tests (Playwright) & unit tests (Vitest)
│   └── *.spec.ts / *.test.ts
├── ui/                      # React components
│   └── {sub_feature}/       # Nested by sub-feature
└── index.ts                 # Barrel exports (public API)
```

---

## Data Layer

- **REST:** Hooks generated by Orval into `src/__codegen__/rest/{service}/`. Uses SWR. Import from there — never edit generated files.

### Adding a new REST service

1. Create `schema/{service}/services.config.json`:

   ```json
   {
     "repo": "{github-repo-name}",
     "path": "/api/swagger.yaml",
     "branch": "main",
     "production": false
   }
   ```

   Where `repo` is the repo name in the [PACT-Toolkit](https://github.com/PACT-Toolkit) GitHub org.

   **`production` flag** controls CI failure behaviour for `pnpm api:update`:
   - `false` (default) — download failure prints a warning and continues. Safe while the backend service is still in early development or the schema isn't stable.
   - `true` — download failure exits non-zero and breaks CI. Set this once the service is stable and schema drift must be caught immediately.

   Flip to `true` when the service ships to production.

2. Run `pnpm api:update` — downloads `swagger.yaml` from GitHub and generates hooks in `src/__codegen__/rest/{service}/`.

**Requires** `GITHUB_TOKEN` (or `GIT_TOKEN`) in env with read access to the PACT-Toolkit GitHub org.

**Schema folder naming:** The folder name is used verbatim as the proxy path segment — `/api/pact/{folder-name}/...` — so it must match the **backend URL path**. Confirm the correct name via the swagger `basePath` or a real network request.

**Generated files are committed** — after running `api:update`, commit both `schema/{service}/swagger.yaml` and the updated `src/__codegen__/rest/{service}/`.

---

## Conventions

### Naming

| Type         | Convention                     | Example                 |
| ------------ | ------------------------------ | ----------------------- |
| Components   | PascalCase with feature prefix | `PolicyDetailSideSheet` |
| Hook files   | snake*case with `use*` prefix  | `use_get_policy.ts`     |
| Hook exports | camelCase                      | `useGetPolicy`          |
| Test files   | snake_case with `.spec.ts`     | `policy_detail.spec.ts` |

Use `uuidv4()` from the `uuid` package for all UUID generation. Import as: `import { v4 as uuidv4 } from 'uuid'`.

### Styling

Use **Tailwind CSS** utility classes for all styling. Avoid inline styles and CSS modules unless Tailwind cannot express the style.

### UI Components

Use **shadcn/ui** for all UI components. Components live in `src/components/ui/` and are owned by the project — edit them freely to match product requirements.

Use Radix primitives directly for anything shadcn/ui does not cover.

---

## Worktrees

- **Naming:** `../pact-web-{identifier}` (e.g., `../pact-web-pact-123`)
- **After creating:** run `pnpm install` and `pnpm run msw:init` in the new worktree
- **Parallel Playwright:** Set `PLAYWRIGHT_PORT=<unique-port>` (e.g., `PLAYWRIGHT_PORT=3001 pnpm pw:run`) to avoid port conflicts when running E2E tests in multiple worktrees simultaneously

---

## Gotchas

- **Never edit** `__codegen__/` directories — regenerate with `pnpm rest:codegen`
- Always use `@/` alias for absolute imports — ESLint boundaries will fail on incorrect cross-module imports
- **Never replace `<>` fragments** with wrapper elements (e.g., `<div>`) — grid and flex layouts depend on direct child relationships, and adding a wrapper breaks them
- After cloning or creating a worktree, run `pnpm run msw:init` once to initialize the MSW service worker
