#!/usr/bin/env node

/**
 * Sync Rule Files
 *
 * `.agents/rules/*.mdc` is the single source of truth for the coding rules
 * every AI tool in this repo reads. Cursor only looks under `.cursor/rules/`
 * and Claude Code only looks under `.claude/rules/`, so each rule file is
 * mirrored, byte-for-byte, into both directories.
 *
 * A git symlink (the mechanism used for `.agents/skills/`) would collapse
 * this to a single file, but symlinks are unreliable on Windows checkouts
 * (git only writes real symlinks when `core.symlinks` is enabled, which is
 * not the default), so a mirrored copy plus a CI byte-identity check
 * ("Check mirrored rule files are in sync" in .github/workflows/ci.yml) is
 * used instead. To add a rule, edit only the copy in `.agents/rules/`, then
 * run this script (or `pnpm run rules:sync`) to update the mirrors.
 *
 * Usage: node scripts/sync-rule-files.mjs
 */

import { copyFile, mkdir, readdir, rm } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CANONICAL_DIR = join(ROOT, '.agents/rules');
const MIRROR_DIRS = [join(ROOT, '.cursor/rules'), join(ROOT, '.claude/rules')];

async function main() {
  console.log('🔗 Syncing rule files\n');

  const canonicalFiles = (await readdir(CANONICAL_DIR, { withFileTypes: true }))
    .filter((e) => e.isFile() && e.name.endsWith('.mdc'))
    .map((e) => e.name);

  if (canonicalFiles.length === 0) {
    console.log(`No .mdc files found in ${CANONICAL_DIR}`);

    return;
  }

  for (const mirrorDir of MIRROR_DIRS) {
    await mkdir(mirrorDir, { recursive: true });

    // Remove stale mirrored files that no longer exist in the canonical dir,
    // so a rename or delete under .agents/rules/ can never leave an orphan
    // copy behind.
    const existing = (await readdir(mirrorDir, { withFileTypes: true }))
      .filter((e) => e.isFile() && e.name.endsWith('.mdc'))
      .map((e) => e.name);

    for (const staleFile of existing.filter(
      (name) => !canonicalFiles.includes(name)
    )) {
      await rm(join(mirrorDir, staleFile));
      console.log(`  🗑️  removed stale ${mirrorDir}/${staleFile}`);
    }

    for (const file of canonicalFiles) {
      await copyFile(join(CANONICAL_DIR, file), join(mirrorDir, file));
    }

    console.log(`  ✅ ${mirrorDir} (${canonicalFiles.length} file(s))`);
  }

  console.log('\n✨ Done\n');
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
