---
name: writing-unit-tests
description: "Write unit tests with Vitest. Use when asked to 'add unit tests', 'test this function', 'migrate to Vitest', or when creating *.test.ts files. NOT for E2E or browser tests."
---

# Writing Unit Tests (Vitest)

Write fast, focused unit tests using Vitest with standard APIs only — no custom helpers.

## The bar

Tests are load-bearing safety infrastructure — they are how future AI agents know they didn't break user behavior when they refactor. Hold every test to this bar:

- **Behavior over implementation.** Assert on what the function returns / what state changes for callers. Never assert on internal calls, internal state shape, or "was this private helper invoked." A future agent must be able to refactor the internals freely as long as behavior holds.
- **Future-agent test:** ask _"if a future agent rewrites this function and accidentally breaks real behavior, would this test fail loudly?"_ If "maybe" or "only on the obvious break," strengthen it.
- **Coverage by category, not line.** For any non-trivial function, address (where applicable): happy path, empty / missing input, boundary values (min, max, off-by-one, zero, negative), error paths (thrown, rejected, invalid), and locale / type variants if the function accepts them.
- **Bug fixes require a regression test.** Failing pre-fix, passing post-fix — both states confirmed. No regression test = the bug is deferred.
- **No flake.** Pin dates, never `new Date()`. No `Math.random`. No order-dependent state. Each test independent.
- **Don't mock the thing you're testing.** Mock its dependencies, not itself. Mocking the validator and asserting it was called is not a test.
- **No snapshot tests for component logic.** Snapshots lock markup, not behavior.

## What Belongs in a Unit Test

| Code type | Unit test? | Example |
|---|---|---|
| Pure functions | ✅ Yes | `formatDate()`, `parseQuery()`, `toAmount()` |
| Business logic | ✅ Yes | Validation schemas, calculations, transformations |
| Utilities | ✅ Yes | String helpers, date formatting, number formatting |
| React hooks / context | ✅ Yes | Custom hooks with React Testing Library |
| User flows | ❌ No | Login, navigation, multi-step forms |
| Real browser automation | ❌ No | Page navigation, scrolling, multi-tab |
| Visual / layout | ❌ No | Screenshots, responsive breakpoints |

**Rule of thumb**: If it doesn't need a browser, it's a unit test.

## File Naming & Location

- **Extension**: `*.test.ts` (or `*.test.tsx` for component tests)
- **Location**: Co-located with source in a `test/` directory

```
src/app/my_feature/
├── domain/
│   └── my_logic.ts
├── test/
│   └── my_logic.test.ts      ← unit test here
└── ui/
    └── MyComponent.tsx
```

## Running Tests

```bash
pnpm test          # Single run (CI)
pnpm test:watch    # Watch mode (development)
```

## Path Aliases

All project path aliases work in test files:

```ts
import { myFunction } from '@/src/app/my_feature/domain/my_logic';
import { mockData } from '@/mocks/my_feature';
```

## Vitest Patterns

### Test Structure

```ts
import { describe, expect, it } from 'vitest';

describe('myFunction', () => {
  it('should return expected result for valid input', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });

  it('should handle edge case', () => {
    expect(myFunction('')).toBeUndefined();
  });
});
```

### Common Assertions

```ts
// Exact equality (primitives)
expect(value).toBe(42);
expect(value).toBe('hello');
expect(value).toBe(true);

// Deep equality (objects, arrays)
expect(obj).toEqual({ name: 'test', count: 1 });
expect(arr).toEqual([1, 2, 3]);

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(value).toBeGreaterThan(3);
expect(value).toBeLessThanOrEqual(10);
expect(value).toBeCloseTo(0.3, 5);

// Strings
expect(str).toContain('substring');
expect(str).toMatch(/pattern/);

// Arrays & iterables
expect(arr).toContain(item);
expect(arr).toHaveLength(3);

// Objects
expect(obj).toHaveProperty('key');
expect(obj).toHaveProperty('key', 'value');
expect(obj).toMatchObject({ name: 'test' });

// Exceptions
expect(() => riskyCall()).toThrow();
expect(() => riskyCall()).toThrow('specific message');
expect(() => riskyCall()).toThrow(TypeError);
```

### Mocking

```ts
import { vi } from 'vitest';

// Mock a function
const mockFn = vi.fn();
mockFn.mockReturnValue(42);
mockFn.mockResolvedValue({ data: 'async result' });

// Verify calls
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
expect(mockFn).toHaveBeenCalledTimes(2);

// Spy on existing method
const spy = vi.spyOn(object, 'method');
spy.mockImplementation(() => 'mocked');
// ...test...
spy.mockRestore();

// Mock a module
vi.mock('@/src/framework/utils/my_util', () => ({
  myUtil: vi.fn(() => 'mocked'),
}));
```

### Setup & Teardown

```ts
import { afterEach, beforeEach, describe, it } from 'vitest';

describe('with setup', () => {
  beforeEach(() => {
    // runs before each test
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('test case', () => {
    // ...
  });
});
```

---

## Proven Test Patterns

### Date / Time Utilities

- Pin a reference date (`const now = new Date(2021, 6, 20, 14, 10)`) — never use `new Date()`
- Use `date-fns` helpers (`addDays`, `subMonths`) to create relative dates for branch coverage
- Test both string and function formatters, plus fallback behavior when formatters throw
- Test null/undefined/invalid date inputs return empty string

### Parser / Transformer Logic

- Group tests by concern with `describe` blocks (matching, extraction, edge cases, scoring)
- Test multilingual inputs when the function supports multiple locales
- Test edge cases: empty string, whitespace-only, gibberish, numbers-only
- Test `undefined` fields with `toBe(undefined)` when checking optional result properties

### Number / Currency Formatting

- Create a shared locale/config object and reuse across tests
- Test both string and number inputs to verify type coercion
- Always use `\u00A0` (non-breaking space) in expected strings — see [Gotcha: Non-Breaking Spaces](#gotcha-non-breaking-spaces-in-intlnumberformat)
- Test locale-specific output (thousand separators, decimal commas, negative values, NaN)

### Functions with Complex Dependencies

- Create mock implementations typed against the real interface to catch shape mismatches
- Build a shared context object and a thin wrapper for clean test calls
- Use `toContain()` for output with locale-dependent parts; `toBe()` for fully controlled output
- Test each concern (parsing, formatting, edge cases) in separate `describe` blocks

---

## Mocking Patterns

### Typed Mock Objects

When the function under test depends on formatter objects or context providers, type mocks against the real interface:

```ts
import type { FormatterContext } from './my_formatter';

// Mock matches the real interface shape
const mockFormat: FormatterContext['format'] = ({ value, currency }) => {
  return `${currency} ${value.toFixed(2)}`;
};

const context: FormatterContext = {
  format: mockFormat,
  dateFormat: mockDateFormat,
};

// Thin wrapper for clean test calls
const process = (input: string) => processString(input, context);
```

### When to Mock vs. Use Real Implementations

| Scenario | Approach |
|---|---|
| Pure utility (no deps) | No mocks needed — call directly |
| Function with formatter deps | Mock the formatters, type them against the real interface |
| Function using `Intl` APIs | Use real `Intl` — but beware of locale-specific output (use `toContain`) |
| Function with external API calls | Mock the API module with `vi.mock()` |

---

## Gotchas & Lessons Learned

### Gotcha: Non-Breaking Spaces in `Intl.NumberFormat`

`Intl.NumberFormat` uses non-breaking space (U+00A0, `\xa0`) between amounts and currency symbols (e.g. `1,00\u00A0kr.`), and some locales use narrow no-break space (U+202F) for thousand separators. These look identical to regular spaces but fail `toBe()` assertions.

Use `\u00A0` in expected strings and add a comment explaining why:

```ts
// Intl.NumberFormat uses non-breaking space (U+00A0) before currency symbols
expect(result).toBe('1,00\u00A0kr.');
```

### Gotcha: Locale-Dependent Output

Date and number formatting varies by locale and Node.js version. When testing formatted output:

- **Fully controlled output** → use `toBe()` for exact match
- **Locale-dependent parts** → use `toContain()` or `toMatch()` to assert key fragments
- Example: `expect(result).toContain('2024')` instead of asserting the full Danish date string

### Gotcha: Relative vs. Alias Imports

- Tests in `test/` directories should use path aliases for imports from other modules
- Tests co-located next to source (same directory) can use relative imports (`'./my_module'`)
- ESLint boundary rules apply — respect module hierarchy in imports

### Gotcha: Testing Both String and Number Inputs

Many utility functions accept `string | number`. Always test both:

```ts
const fromString = formatAmount({ value: '1', currency: 'dkk' });
const fromNumber = formatAmount({ value: 1, currency: 'dkk' });
expect(fromString).toBe(fromNumber);
```

### Gotcha: Pin Dates for Deterministic Tests

Never use `new Date()` — tests will break at midnight or across timezones:

```ts
// ✅ Pinned date
const now = new Date(2021, 6, 20, 14, 10);

// ❌ Flaky — changes every run
const now = new Date();
```

## Progressive disclosure — load on demand

These references stay out of the agent's context until the relevant trigger appears. Open the file when its trigger fires, not preemptively.

| Read this | When |
| --------- | ---- |
| [`references/component-imports.md`](references/component-imports.md) | Importing a module under test fails with `styled is not a function` / `matter-web` errors because the module mixes pure logic with React component imports. |

