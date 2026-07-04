import { v4 as uuidv4 } from 'uuid';

import { type DB } from '@/mocks/data/dbFactory';
import {
  type AuditEvent,
  type QueryDecisionStatsResponse,
} from '@/src/__codegen__/rest/audit';
import { type FilterLoadedPackResponse } from '@/src/__codegen__/rest/filter';
import { withFalsePositiveFlag } from '@/src/app/filter/domain/filter_decision';

export interface DecisionPayload {
  request_id: string;
  user_id?: string;
  decision: 'allow' | 'block';
  reason?: string;
  filter_rule_id?: string;
  latency_ms: number;
  created_at: string;
  is_false_positive?: boolean;
}

// Stateless fixture for GET /v1/filter/packs (no CRUD needed -- see
// pact-mock-data's "stateless mock data" pattern). One pack per engine kind
// pact-filter actually runs, mirroring the shapes documented in
// pact-gateway's api/swagger/filter.yaml.
export const MOCK_LOADED_PACKS: FilterLoadedPackResponse[] = [
  {
    id: 'pack-builtin-injection',
    name: 'Built-in prompt injection pack',
    version: 'v3',
    source: 'built_in',
    engineKind: 'regex',
    ruleCount: 128,
    loadedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'pack-builtin-semantic',
    name: 'Semantic similarity engine',
    version: 'v1',
    source: 'built_in',
    engineKind: 'vector',
    ruleCount: 42,
    loadedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'pack-policy-custom',
    name: 'Policy-synced custom rules',
    version: 'v7',
    source: 'policy_synced',
    engineKind: 'literal',
    ruleCount: 15,
    loadedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
];

export const mockDecisionEvent = (
  overrides: Partial<AuditEvent>
): AuditEvent => ({
  id: uuidv4(),
  topic: 'pact.decisions',
  eventId: 'filter.decision',
  requestId: '',
  payloadJson: '',
  createdAt: new Date().toISOString(),
  ...overrides,
});

const parseDecisionPayload = (raw: string): DecisionPayload | null => {
  try {
    return JSON.parse(raw) as DecisionPayload;
  } catch {
    return null;
  }
};

const topRuleCounts = (
  counts: Record<string, number>,
  limit = 3
): { label: string; count: number }[] =>
  Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));

/**
 * Mock counterpart of pact-audit's SQL-side decision stats aggregate --
 * computes the exact GET /v1/audit/stats shape over the mock decisions
 * repository so mock mode exercises the same contract as pact-gateway.
 *
 * The mock DecisionPayload only models the filter stage (decision,
 * filter_rule_id, reason); it never populates the nested classifier/
 * redactor/consensus objects the real gateway payload carries, so those
 * two stages come back genuinely empty here -- same as they always have
 * in mock mode, since the pre-existing client-side aggregation read those
 * same (never-populated) fields.
 */
export const computeDecisionStats = (
  events: AuditEvent[],
  window: { sinceUnix?: number; untilUnix?: number } = {}
): QueryDecisionStatsResponse => {
  const { sinceUnix, untilUnix } = window;
  const matched = events.filter((event) => {
    const createdUnix = Math.floor(new Date(event.createdAt).getTime() / 1000);
    if (sinceUnix !== undefined && createdUnix < sinceUnix) return false;
    if (untilUnix !== undefined && createdUnix >= untilUnix) return false;

    return true;
  });

  let blocked = 0;
  const ruleCounts: Record<string, number> = {};
  let latestAtUnix = 0;

  for (const event of matched) {
    const createdUnix = Math.floor(new Date(event.createdAt).getTime() / 1000);
    if (createdUnix > latestAtUnix) latestAtUnix = createdUnix;

    const payload = parseDecisionPayload(event.payloadJson);
    if (!payload) continue;

    if (payload.decision === 'block') {
      blocked++;
      const ruleId = payload.filter_rule_id ?? payload.reason;
      if (ruleId) ruleCounts[ruleId] = (ruleCounts[ruleId] ?? 0) + 1;
    }
  }

  const total = matched.length;
  const topRules = topRuleCounts(ruleCounts);

  return {
    total,
    latest_at_unix: latestAtUnix,
    filter: {
      // The mock payload has no nested filter.verdict; every blocked
      // decision in the fixtures carries reason "filter_hostile", so
      // block == flagged == hostile here.
      flagged: blocked,
      blocked,
      block_rate: total > 0 ? (blocked / total) * 100 : 0,
      top_rule_id: topRules[0]?.label ?? '',
      suspicious: 0,
      hostile: blocked,
      top_rules: topRules,
    },
    classifier: {
      responded: 0,
      tagged: 0,
      top_label: '',
      avg_tagged_score: 0,
      consensus: 0,
      labels: [],
    },
    redactor: {
      redacted: 0,
      spans: 0,
      redaction_rate: 0,
      span_labels: [],
    },
  };
};

const BLOCKED_RULES = [
  'inject-003',
  'inject-005',
  'role-001',
  'role-005',
  'inject-011',
  'inject-016',
  'jailbreak-001',
  'inject-012',
];

const buildEvent = (
  offsetMs: number,
  payload: DecisionPayload
): Partial<AuditEvent> => {
  const createdAt = new Date(Date.now() - offsetMs).toISOString();

  return {
    requestId: payload.request_id,
    payloadJson: JSON.stringify({ ...payload, created_at: createdAt }),
    createdAt,
  };
};

export const createFilterMockData = (db: DB): void => {
  const min = 60_000;
  const hour = 60 * min;

  const seed = (offsetMs: number, payload: DecisionPayload) => {
    db.decisions.create(buildEvent(offsetMs, payload));
  };

  seed(2 * min, {
    request_id: 'req-a1b2c3',
    decision: 'block',
    reason: 'filter_hostile',
    filter_rule_id: 'inject-003',
    latency_ms: 4,
    created_at: '',
  });
  seed(5 * min, {
    request_id: 'req-d4e5f6',
    decision: 'allow',
    latency_ms: 2,
    created_at: '',
  });
  seed(8 * min, {
    request_id: 'req-g7h8i9',
    decision: 'block',
    reason: 'filter_hostile',
    filter_rule_id: 'role-001',
    latency_ms: 5,
    created_at: '',
  });
  seed(12 * min, {
    request_id: 'req-j1k2l3',
    decision: 'allow',
    latency_ms: 3,
    created_at: '',
  });
  seed(15 * min, {
    request_id: 'req-m4n5o6',
    decision: 'block',
    reason: 'filter_hostile',
    filter_rule_id: 'inject-005',
    latency_ms: 6,
    created_at: '',
  });
  seed(20 * min, {
    request_id: 'req-p7q8r9',
    decision: 'allow',
    latency_ms: 2,
    created_at: '',
  });
  seed(25 * min, {
    request_id: 'req-s1t2u3',
    decision: 'block',
    reason: 'filter_hostile',
    filter_rule_id: 'inject-003',
    latency_ms: 4,
    created_at: '',
  });
  seed(30 * min, {
    request_id: 'req-v4w5x6',
    decision: 'block',
    reason: 'filter_hostile',
    filter_rule_id: 'role-005',
    latency_ms: 3,
    created_at: '',
  });
  seed(35 * min, {
    request_id: 'req-y7z8a9',
    decision: 'allow',
    latency_ms: 2,
    created_at: '',
  });
  seed(40 * min, {
    request_id: 'req-b1c2d3',
    decision: 'block',
    reason: 'filter_hostile',
    filter_rule_id: 'inject-011',
    latency_ms: 5,
    created_at: '',
  });
  seed(45 * min, {
    request_id: 'req-e4f5g6',
    decision: 'allow',
    latency_ms: 3,
    created_at: '',
  });
  seed(50 * min, {
    request_id: 'req-h7i8j9',
    decision: 'block',
    reason: 'filter_hostile',
    filter_rule_id: 'inject-016',
    latency_ms: 4,
    created_at: '',
  });
  seed(55 * min, {
    request_id: 'req-k1l2m3',
    decision: 'allow',
    latency_ms: 2,
    created_at: '',
  });
  seed(hour + 5 * min, {
    request_id: 'req-n4o5p6',
    decision: 'block',
    reason: 'filter_hostile',
    filter_rule_id: 'jailbreak-001',
    latency_ms: 7,
    created_at: '',
  });
  seed(hour + 15 * min, {
    request_id: 'req-q7r8s9',
    decision: 'allow',
    latency_ms: 2,
    created_at: '',
  });
  seed(hour + 25 * min, {
    request_id: 'req-t1u2v3',
    decision: 'block',
    reason: 'filter_hostile',
    filter_rule_id: 'inject-012',
    latency_ms: 4,
    created_at: '',
  });
  seed(hour + 35 * min, {
    request_id: 'req-w4x5y6',
    decision: 'block',
    reason: 'filter_hostile',
    filter_rule_id: 'inject-003',
    latency_ms: 5,
    created_at: '',
  });
  seed(2 * hour, {
    request_id: 'req-z7a8b9',
    decision: 'allow',
    latency_ms: 2,
    created_at: '',
  });
  seed(2 * hour + 20 * min, {
    request_id: 'req-c1d2e3',
    decision: 'block',
    reason: 'filter_hostile',
    filter_rule_id:
      BLOCKED_RULES[Math.floor(Math.random() * BLOCKED_RULES.length)],
    latency_ms: 4,
    created_at: '',
  });
  seed(3 * hour, {
    request_id: 'req-f4g5h6',
    decision: 'allow',
    latency_ms: 3,
    created_at: '',
  });
};

// PACT-325's persisted-FP-flag loop needs to survive a real page reload to
// be a meaningful E2E check, but `db` itself cannot -- it's a plain
// module-scope object re-created from these seeders every time this module
// re-evaluates, which happens on every full navigation in the browser (the
// Node-side MSW instance behind instrumentation.ts is a *different*, SSR-only
// db that client-side orval/SWR fetches never reach). sessionStorage is the
// one thing that outlives a reload within the same tab, so it's used here
// purely as a dev:mock demo aid -- it has no bearing on the real gateway,
// which has no read-back for LabelVerdict at all (see
// filter_false_positive.ts's docblock).
const FALSE_POSITIVE_STORAGE_KEY = 'pact-mock-false-positive-request-ids';

const readPersistedFalsePositiveRequestIds = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(FALSE_POSITIVE_STORAGE_KEY);

    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    // Private-browsing/quota-exceeded/corrupt-JSON edge cases -- losing
    // reload-persistence in the mock demo is harmless, so fail open to "no
    // flags yet" rather than throwing.
    return [];
  }
};

// Called by the classifier mock handler (PACT-325 part 3) right after it
// stamps is_false_positive onto the live db.decisions row, so the flag can
// be re-applied after the next reseed.
export const persistFalsePositiveRequestId = (requestId: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const ids = new Set(readPersistedFalsePositiveRequestIds());
    ids.add(requestId);
    window.sessionStorage.setItem(
      FALSE_POSITIVE_STORAGE_KEY,
      JSON.stringify([...ids])
    );
  } catch {
    // Same fail-open reasoning as the read side above.
  }
};

// Called once from dbFactory.ts after every decisions-producing seeder has
// run (filter/consensus/redactor/classifier all append to db.decisions), so
// every request id a previous session may have flagged has a row to match
// against.
export const reapplyPersistedFalsePositiveFlags = (db: DB): void => {
  for (const requestId of readPersistedFalsePositiveRequestIds()) {
    db.decisions.update(
      (event) => event.requestId === requestId,
      (event) => ({
        ...event,
        payloadJson: withFalsePositiveFlag(event.payloadJson),
      })
    );
  }
};
