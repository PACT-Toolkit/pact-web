// @vitest-environment node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
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

const listTrackedFiles = (): string[] => {
  const result = spawnSync('git', ['ls-files', '-z', '--', 'src', 'schema'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `git ls-files failed: ${result.error?.message ?? result.stderr}`
    );
  }

  return result.stdout.split('\0').filter(Boolean);
};

describe('public tree hygiene', () => {
  it('has no internal tracker ids in tracked src/ or schema/ files', () => {
    const files = listTrackedFiles();

    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const absolute = path.join(REPO_ROOT, file);
      // A tracked file deleted in the working tree is not a leak.
      if (!fs.existsSync(absolute)) continue;
      const lines = fs.readFileSync(absolute, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (TRACKER_ID.test(line)) offenders.push(`${file}:${index + 1}`);
      });
    }

    expect(
      offenders,
      `internal tracker ids found in the public tree:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
