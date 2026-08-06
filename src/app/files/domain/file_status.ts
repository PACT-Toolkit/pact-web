// Domain-owned vocabulary for FilesFileResponse.status (GET/POST /v1/files).
// pact-gateway's generated per-tag OpenAPI slice (schema/files, PACT-706)
// serialises status as a free-form `string` with no enum, so this closed
// set - and its display fallback - has to be a client-side refinement, same
// pattern as policy_rule.ts's RuleStatus over the equally free-form
// RulesRuleResponse.status. This is the single place that vocabulary lives;
// FilesStatusBadge's palette and any other status-driven display logic
// should key off FILE_STATUSES rather than re-typing the list.
export const FILE_STATUSES = [
  'pending',
  'processing',
  'ready',
  'rejected',
  'deleted',
] as const;

export type FileStatus = (typeof FILE_STATUSES)[number];

// pact-files defaults a freshly-created record to "pending" before the
// upload-confirm step runs, so an absent/unrecognised status reads the same
// way here.
export const DEFAULT_FILE_STATUS: FileStatus = 'pending';

export const isFileStatus = (value: string): value is FileStatus =>
  (FILE_STATUSES as readonly string[]).includes(value);
