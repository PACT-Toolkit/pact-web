# Modules that mix pure logic with React component imports

Load this when unit-testing a domain module whose source file also imports React components — Vitest will throw errors when you import the module under test because shadcn/ui or Tailwind utilities aren't set up to run under the unit-test environment.

## Why it happens

Some domain files (e.g. `step_configuration.ts`) export pure logic (navigation functions, configuration objects) but also reference React components in the same file. Importing that module in Vitest pulls in shadcn/ui / Radix / Tailwind transitively, and those packages aren't set up to run under the unit-test environment.

## Fix

Mock each component module at the top of the test file with `vi.mock(...)` returning a minimal stub. The mocks prevent the component imports from loading while leaving the logic exports of the module under test intact:

```ts
vi.mock('../ui/flow_steps/PolicyApprovalStep', () => ({
  PolicyApprovalStep: () => null,
}));
// repeat for each component import in the module under test
import { STEP_CONFIGURATION } from '../domain/step_configuration';
```

## Source-order gotcha

`vi.mock` calls are hoisted to the top of the file by Vitest even if written after imports — but the `import` of the module under test must be written **after** the `vi.mock` calls in source order so the hoisting produces the right execution order. If you put the import first, mocks won't be applied to it.
