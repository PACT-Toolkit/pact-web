---
name: pact-mock-data
description: Conventions for adding or editing per-feature MSW mocks in pact-web — the `MockRepository<T>` + central `db` factory pattern, the `mock/data` vs `mock/handlers` split, instantiator + `createXMockData(db)` seeders, and how handlers read/write via `db.<entity>`. Use when scaffolding a new feature's mock layer, migrating an existing one, or wiring a new endpoint into MSW.
---

# pact-mock-data

How per-feature mocks are structured in pact-web. Every feature follows the same shape so handlers in one module look like handlers in any other.

## File layout

For a feature `src/app/<feature>/`:

```
src/app/<feature>/
├── mock/
│   ├── data/
│   │   └── index.ts          # type + instantiator + createXMockData(db) seeder
│   └── handlers/
│       └── index.ts          # MSW handlers reading via db.<entity>.<op>()
└── ... (ui, domain, data layers as needed)
```

The central `db` lives at `mocks/data/dbFactory.ts`. The generic store is `mocks/data/repository.ts` (`MockRepository<T>` with `create / update / delete / getAll / findFirst / findMany`). You don't edit those when adding a new feature — you contribute to `dbFactory.ts`.

## Adding a new feature mock

1. **`src/app/<feature>/mock/data/index.ts`** — export the type, an instantiator, and a seeder. The seeder takes `db: DB` and calls `db.<entity>.create({...})` for every row you want at startup. Instantiator + types come from the codegen REST layer when available.

   ```ts
   import { type DB } from '@/mocks/data/dbFactory';
   import { type Widget } from '@/src/__codegen__/rest/widget';

   export const mockWidget = (overrides: Partial<Widget>): Widget => ({
     id: '',
     label: '',
     enabled: false,
     ...overrides,
   });

   export const createWidgetMockData = (db: DB): void => {
     db.widgets.create({ id: 'w-1', label: 'First widget', enabled: true });
     db.widgets.create({ id: 'w-2', label: 'Second widget' });
   };
   ```

2. **`mocks/data/dbFactory.ts`** — register the repo and invoke the seeder at module load. Imports are alphabetical inside groups (`import-x/order` enforces this).

   ```ts
   import { createWidgetMockData, mockWidget } from '@/src/app/widget/mock/data';
   import { type Widget } from '@/src/__codegen__/rest/widget';

   export const db = {
     // ...
     widgets: new MockRepository<Widget>(mockWidget),
   };

   createWidgetMockData(db);
   ```

3. **`src/app/<feature>/mock/handlers/index.ts`** — write MSW handlers that read/write via `db.widgets.<op>()`. **Always use `*/...` glob paths** (see [Handler patterns](#handler-patterns) below).

   ```ts
   import { http, HttpResponse, type RequestHandler } from 'msw';
   import { db } from '@/mocks/data/dbFactory';

   export const handlers: RequestHandler[] = [
     http.get('*/v1/widgets', () => HttpResponse.json(db.widgets.getAll())),

     http.put('*/v1/widgets/:id', async ({ params, request }) => {
       const { id } = params as { id: string };
       const body = (await request.json()) as { enabled: boolean };
       const updated = db.widgets.update(
         w => w.id === id,
         w => ({ ...w, enabled: body.enabled }),
       );
       if (!updated) return HttpResponse.json({ error: 'not found' }, { status: 404 });
       return HttpResponse.json(updated);
     }),
   ];
   ```

4. **`mocks/handlers.ts`** — spread the feature's handlers into the central array. Keep import order alphabetical.

   ```ts
   import { handlers as widgetHandlers } from '@/src/app/widget/mock/handlers';

   export const handlers: RequestHandler[] = [
     // ...
     ...widgetHandlers,
   ];
   ```

That's it — no other wiring. `dbFactory.ts` is imported by `mocks/handlers.ts`, which is imported by both `mocks/browser.ts` (browser worker) and `mocks/server.ts` (Node setupServer used by Vitest + `instrumentation.ts`).

## Repository operations

`MockRepository<T>` exposes:

| Method | Returns | Notes |
|---|---|---|
| `create(partial)` | `T` | Runs the instantiator with `partial` overrides and appends. |
| `update(predicate, mutator)` | `T \| undefined` | First-match wins; returns mutated row or `undefined` if no match. |
| `delete(predicate)` | `void` | Removes every match. |
| `getAll()` | `T[]` | Live array — don't mutate it directly. |
| `findFirst(predicate)` | `T \| undefined` | |
| `findMany(predicate)` | `T[]` | |

For singleton entities (one profile per session, etc.), seed exactly one row and read via `db.<entity>.findFirst(() => true)!`.

## Handler patterns

**Always glob.** Paths must start with `*/`, never a leading slash:

```ts
// ✅ matches in browser, Node setupServer, and instrumentation hook
http.get('*/v1/widgets', () => ...);

// ❌ silently fails on the server side — leaks to the real backend
http.get('/v1/widgets', () => ...);
```

This is enforced by `src/framework/helpers/msw_handler_patterns.test.ts` — CI fails listing every offender. The reason: relative paths only resolve against `location.origin`, which exists in the browser but not in Node.

## Persona-aware mocks

If a handler should vary by mock user type (admin / auditor / developer), call `getMockUserType()` at request time and overlay persona fields before responding. Don't re-seed the repo on every request — overlay onto whatever the user has mutated since startup:

```ts
import { getMockUserType } from '@/src/framework/helpers/mock_user_type';

http.get('*/v1/account/profile', () => {
  const persona = profilePersonaFor(getMockUserType());
  db.accountProfile.update(
    () => true,
    p => ({ ...p, displayName: persona.displayName }),
  );
  return HttpResponse.json(db.accountProfile.findFirst(() => true)!);
});
```

Server-side handlers (running under setupServer) read the cookie via `next/headers` instead of `document.cookie`; `getMockUserType()` handles the missing-document case by returning `'admin'`. If you need server-side persona reads, plumb the cookie value explicitly through the request context.

## What NOT to do

- **Don't invent per-feature stores.** If you find yourself writing `const widgetStore: Widget[] = [...]` at module scope in a handler file, you're working against the pattern — put it in `db.widgets` instead.
- **Don't write fixtures alongside handlers.** Keep types + seeders in `mock/data/`; handlers should only orchestrate.
- **Don't bypass `db` for mutations.** Closing over a mutable module-scoped variable defeats the central seed-from-zero behavior (no way to reset between Vitest tests, no way to inspect from devtools, no shared semantics with other features).
- **Don't use leading-slash paths.** Even if it works in the browser, the hygiene test will fail CI.
- **Don't seed in handlers.** Seeders run once at `dbFactory.ts` module load. Re-seeding on every request makes data unpredictable.

## Related skills

- `pact-dev-mock` — overall dev/dev:mock plumbing (env helpers, MSW bootstrap, auto-login, persona switcher).
