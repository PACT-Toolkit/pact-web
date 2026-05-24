# pact-component-naming

Naming conventions for React components in pact-web. Follow these rules in every new file and when renaming.

## Rules

### One component per file

Every `.tsx` file exports exactly **one** React component. Helper functions (`formatTimestamp`, `prettyPayload`, etc.) are fine to co-locate, but no second named component export.

### Feature-prefix naming

Components in a feature folder take the feature folder name as a prefix, in PascalCase.

| Folder | Prefix | Example |
|---|---|---|
| `src/app/test_lab/ui/` | `TestLab` | `TestLabLayerNode`, `TestLabResultNode` |
| `src/app/audit/ui/` | `Audit` | `AuditRow`, `AuditDecisionInsights` |
| `src/app/policy/ui/` | `Policy` | `PolicyDetailSideSheet` |
| `src/app/benchmark/ui/` | `Benchmark` | `BenchmarkResultCard` |

### Sub-folder naming

When a feature has a sub-folder, the prefix is **parent + sub**, concatenated in PascalCase.

```
src/app/test_lab/ui/pipeline/
  → prefix: TestLabPipeline
  → example: TestLabPipelineConnector
```

### File name matches export name

The file name (kebab-case or PascalCase) must mirror the export name exactly.

```
TestLabLayerNode.tsx  →  export const TestLabLayerNode = ...
AuditDecisionInsights.tsx  →  export const AuditDecisionInsights = ...
```

Never use a generic name (`index.tsx` inside `ui/` is the only exception — it's the barrel).

### Barrel file (`index.ts`)

Each feature exposes its public API through `src/app/{feature}/index.ts`. It re-exports only the top-level component(s) consumers need. Sub-components that are only used internally do **not** need to appear in the barrel.

```ts
// src/app/test_lab/index.ts
export { TestLabWorkbench } from './ui/TestLabWorkbench';
```

## Quick checklist before creating a new component

1. Does the file contain exactly one component export?
2. Does the component name start with the feature prefix?
3. Does the file name match the export name?
4. If it's publicly consumed outside the feature, is it re-exported from `index.ts`?
