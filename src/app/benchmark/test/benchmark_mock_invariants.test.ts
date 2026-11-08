import { describe, expect, it } from 'vitest';

import { type RunCounts } from '@/src/app/benchmark/domain/benchmark_breakdown';
import { MOCK_RUNS } from '@/src/app/benchmark/mock/data/benchmark';

// The wire invariants the benchmark counts obey. Errored and unscored rows are
// subsets of attacks/benign (an allow nothing blocked); a mitigated attack is
// inside attacks and outside true_positives; a throttled row is the only set
// outside attacks/benign, so attacks + benign + throttled is every row.
const violations = (counts: RunCounts, rowCount: number): string[] => {
  const found: string[] = [];
  if (counts.true_positives + counts.mitigated > counts.attacks) {
    found.push('true_positives + mitigated > attacks');
  }
  if (counts.errors + counts.unscored > counts.attacks + counts.benign) {
    found.push('errors + unscored > attacks + benign');
  }
  if (counts.false_positives > counts.benign) {
    found.push('false_positives > benign');
  }
  if (counts.attacks + counts.benign + counts.throttled !== rowCount) {
    found.push('attacks + benign + throttled != row_count');
  }

  return found;
};

describe('seeded benchmark runs', () => {
  it.each(MOCK_RUNS.filter((run) => run.counts))(
    '$id keeps the run counts consistent',
    (run) => {
      expect(violations(run.counts!, run.row_count)).toEqual([]);
    }
  );

  it.each(MOCK_RUNS.filter((run) => run.per_category))(
    '$id keeps every category consistent and summing to the run counts',
    (run) => {
      const categories = run.per_category!;
      const counts = run.counts!;
      const sum = (pick: (c: (typeof categories)[number]) => number) =>
        categories.reduce((total, c) => total + pick(c), 0);

      for (const c of categories) {
        expect(
          violations(
            {
              attacks: c.attacks,
              benign: c.benign,
              errors: c.errors,
              false_positives: c.fp,
              mitigated: c.mitigated,
              throttled: c.throttled,
              true_positives: c.detected,
              unscored: c.unscored,
            },
            c.entries
          ),
          c.category
        ).toEqual([]);
      }
      expect({
        attacks: sum((c) => c.attacks),
        benign: sum((c) => c.benign),
        errors: sum((c) => c.errors),
        false_positives: sum((c) => c.fp),
        mitigated: sum((c) => c.mitigated),
        throttled: sum((c) => c.throttled),
        true_positives: sum((c) => c.detected),
        unscored: sum((c) => c.unscored),
      }).toEqual(counts);
    }
  );
});
