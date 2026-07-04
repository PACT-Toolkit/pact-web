import { type FilterLoadedPackResponse } from '@/src/__codegen__/rest/filter';

// Display helpers for GET /v1/filter/packs (pact-gateway PACT-450, wired here
// under PACT-325). Read-only introspection: pact-filter reports pack/engine
// metadata only, never rule bodies. Packs are not user-scoped, so every
// authenticated caller sees the same set (mirrors GET /v1/rules).

export const engineKindLabel = (engineKind: string): string => {
  switch (engineKind) {
    case 'regex':
      return 'Regex';
    case 'vector':
      return 'Vector';
    case 'literal':
      return 'Literal';
    default:
      return 'Unknown';
  }
};

export const packSourceLabel = (source: string): string => {
  switch (source) {
    case 'built_in':
      return 'Built-in';
    case 'policy_synced':
      return 'Policy-synced';
    default:
      return 'Unknown';
  }
};

export const packSourceBadgeClass = (source: string): string =>
  source === 'policy_synced'
    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
    : 'bg-muted text-muted-foreground';

// Newest-loaded-first, matching the audit feed's own newest-first convention.
export const sortPacksByLoadedAt = (
  packs: FilterLoadedPackResponse[]
): FilterLoadedPackResponse[] =>
  [...packs].sort(
    (a, b) => new Date(b.loadedAt).getTime() - new Date(a.loadedAt).getTime()
  );
