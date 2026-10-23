// @vitest-environment node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// pact-web is a public repository, so internal issue-tracker ids must never
// appear in tracked source or vendored schemas (comments, test names,
// fixtures, generated clients). This guard fails on any tracked file under
// src/ or schema/ that mentions one, and lists every offender as path:line.
//
// The pattern is assembled from two pieces so this file does not match its
// own scan: no literal tracker id appears anywhere in its source.
const TRACKER_ID = new RegExp('PACT' + '-[0-9]');

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);

// One `git grep` process scans every tracked file under src/ and schema/ in
// git's own native code. Reading each file in the test (about 740 files, 20 s measured)
// took long enough on a loaded machine to cross the 5 s test timeout.
// `git grep` exits 1 when nothing matches, which is the passing case.
const findTrackerIdLines = (): string[] => {
  const result = spawnSync(
    'git',
    ['grep', '-n', '-I', '-E', TRACKER_ID.source, '--', 'src', 'schema'],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  if (result.error || (result.status !== 0 && result.status !== 1)) {
    throw new Error(
      `git grep failed: ${result.error?.message ?? result.stderr}`
    );
  }

  return result.stdout.split('\n').filter(Boolean);
};

describe('public tree hygiene', () => {
  // Spawning git is the one step outside the test's control: process creation
  // on a CPU-starved Windows machine has taken longer than the 5 s default
  // even though the scan itself runs in well under a second. The explicit
  // budget is scoped to this test.
  it(
    'has no internal tracker ids in tracked src/ or schema/ files',
    { timeout: 30_000 },
    () => {
      const offenders = findTrackerIdLines().map((line) =>
        line.split(':', 2).join(':')
      );

      expect(
        offenders,
        `internal tracker ids found in the public tree:\n${offenders.join('\n')}`
      ).toEqual([]);
    }
  );
});
