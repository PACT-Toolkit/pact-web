import { v4 as uuidv4 } from 'uuid';

import { type DB } from '@/mocks/data/dbFactory';
import { type AuditEvent } from '@/src/__codegen__/rest/audit';

export interface DecisionPayload {
  request_id: string;
  user_id?: string;
  decision: 'allow' | 'block';
  reason?: string;
  filter_rule_id?: string;
  latency_ms: number;
  created_at: string;
}

export const mockDecisionEvent = (overrides: Partial<AuditEvent>): AuditEvent => ({
  id: uuidv4(),
  topic: 'pact.decisions',
  eventId: 'filter.decision',
  requestId: '',
  payloadJson: '',
  createdAt: new Date().toISOString(),
  ...overrides,
});

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

const buildEvent = (offsetMs: number, payload: DecisionPayload): Partial<AuditEvent> => {
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
  seed(5 * min, { request_id: 'req-d4e5f6', decision: 'allow', latency_ms: 2, created_at: '' });
  seed(8 * min, {
    request_id: 'req-g7h8i9',
    decision: 'block',
    reason: 'filter_hostile',
    filter_rule_id: 'role-001',
    latency_ms: 5,
    created_at: '',
  });
  seed(12 * min, { request_id: 'req-j1k2l3', decision: 'allow', latency_ms: 3, created_at: '' });
  seed(15 * min, {
    request_id: 'req-m4n5o6',
    decision: 'block',
    reason: 'filter_hostile',
    filter_rule_id: 'inject-005',
    latency_ms: 6,
    created_at: '',
  });
  seed(20 * min, { request_id: 'req-p7q8r9', decision: 'allow', latency_ms: 2, created_at: '' });
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
  seed(35 * min, { request_id: 'req-y7z8a9', decision: 'allow', latency_ms: 2, created_at: '' });
  seed(40 * min, {
    request_id: 'req-b1c2d3',
    decision: 'block',
    reason: 'filter_hostile',
    filter_rule_id: 'inject-011',
    latency_ms: 5,
    created_at: '',
  });
  seed(45 * min, { request_id: 'req-e4f5g6', decision: 'allow', latency_ms: 3, created_at: '' });
  seed(50 * min, {
    request_id: 'req-h7i8j9',
    decision: 'block',
    reason: 'filter_hostile',
    filter_rule_id: 'inject-016',
    latency_ms: 4,
    created_at: '',
  });
  seed(55 * min, { request_id: 'req-k1l2m3', decision: 'allow', latency_ms: 2, created_at: '' });
  seed(hour + 5 * min, {
    request_id: 'req-n4o5p6',
    decision: 'block',
    reason: 'filter_hostile',
    filter_rule_id: 'jailbreak-001',
    latency_ms: 7,
    created_at: '',
  });
  seed(hour + 15 * min, { request_id: 'req-q7r8s9', decision: 'allow', latency_ms: 2, created_at: '' });
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
  seed(2 * hour, { request_id: 'req-z7a8b9', decision: 'allow', latency_ms: 2, created_at: '' });
  seed(2 * hour + 20 * min, {
    request_id: 'req-c1d2e3',
    decision: 'block',
    reason: 'filter_hostile',
    filter_rule_id: BLOCKED_RULES[Math.floor(Math.random() * BLOCKED_RULES.length)],
    latency_ms: 4,
    created_at: '',
  });
  seed(3 * hour, { request_id: 'req-f4g5h6', decision: 'allow', latency_ms: 3, created_at: '' });
};
