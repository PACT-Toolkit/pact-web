import { v4 as uuidv4 } from 'uuid';

import { type AuditEvent } from '@/src/__codegen__/rest/audit';

export interface DecisionPayload {
  request_id: string;
  user_id?: string;
  decision: 'allow' | 'block';
  reason?: string;
  latency_ms: number;
  created_at: string;
}

const now = Date.now();
const min = 60_000;
const hour = 60 * min;

const makeEvent = (offsetMs: number, payload: DecisionPayload): AuditEvent => ({
  id: uuidv4(),
  topic: 'pact.decisions',
  eventId: 'filter.decision',
  requestId: payload.request_id,
  payloadJson: JSON.stringify(payload),
  createdAt: new Date(now - offsetMs).toISOString(),
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

export const mockDecisionEvents: AuditEvent[] = [
  makeEvent(2 * min, {
    request_id: 'req-a1b2c3',
    decision: 'block',
    reason: 'inject-003',
    latency_ms: 4,
    created_at: new Date(now - 2 * min).toISOString(),
  }),
  makeEvent(5 * min, {
    request_id: 'req-d4e5f6',
    decision: 'allow',
    latency_ms: 2,
    created_at: new Date(now - 5 * min).toISOString(),
  }),
  makeEvent(8 * min, {
    request_id: 'req-g7h8i9',
    decision: 'block',
    reason: 'role-001',
    latency_ms: 5,
    created_at: new Date(now - 8 * min).toISOString(),
  }),
  makeEvent(12 * min, {
    request_id: 'req-j1k2l3',
    decision: 'allow',
    latency_ms: 3,
    created_at: new Date(now - 12 * min).toISOString(),
  }),
  makeEvent(15 * min, {
    request_id: 'req-m4n5o6',
    decision: 'block',
    reason: 'inject-005',
    latency_ms: 6,
    created_at: new Date(now - 15 * min).toISOString(),
  }),
  makeEvent(20 * min, {
    request_id: 'req-p7q8r9',
    decision: 'allow',
    latency_ms: 2,
    created_at: new Date(now - 20 * min).toISOString(),
  }),
  makeEvent(25 * min, {
    request_id: 'req-s1t2u3',
    decision: 'block',
    reason: 'inject-003',
    latency_ms: 4,
    created_at: new Date(now - 25 * min).toISOString(),
  }),
  makeEvent(30 * min, {
    request_id: 'req-v4w5x6',
    decision: 'block',
    reason: 'role-005',
    latency_ms: 3,
    created_at: new Date(now - 30 * min).toISOString(),
  }),
  makeEvent(35 * min, {
    request_id: 'req-y7z8a9',
    decision: 'allow',
    latency_ms: 2,
    created_at: new Date(now - 35 * min).toISOString(),
  }),
  makeEvent(40 * min, {
    request_id: 'req-b1c2d3',
    decision: 'block',
    reason: 'inject-011',
    latency_ms: 5,
    created_at: new Date(now - 40 * min).toISOString(),
  }),
  makeEvent(45 * min, {
    request_id: 'req-e4f5g6',
    decision: 'allow',
    latency_ms: 3,
    created_at: new Date(now - 45 * min).toISOString(),
  }),
  makeEvent(50 * min, {
    request_id: 'req-h7i8j9',
    decision: 'block',
    reason: 'inject-016',
    latency_ms: 4,
    created_at: new Date(now - 50 * min).toISOString(),
  }),
  makeEvent(55 * min, {
    request_id: 'req-k1l2m3',
    decision: 'allow',
    latency_ms: 2,
    created_at: new Date(now - 55 * min).toISOString(),
  }),
  makeEvent(hour + 5 * min, {
    request_id: 'req-n4o5p6',
    decision: 'block',
    reason: 'jailbreak-001',
    latency_ms: 7,
    created_at: new Date(now - hour - 5 * min).toISOString(),
  }),
  makeEvent(hour + 15 * min, {
    request_id: 'req-q7r8s9',
    decision: 'allow',
    latency_ms: 2,
    created_at: new Date(now - hour - 15 * min).toISOString(),
  }),
  makeEvent(hour + 25 * min, {
    request_id: 'req-t1u2v3',
    decision: 'block',
    reason: 'inject-012',
    latency_ms: 4,
    created_at: new Date(now - hour - 25 * min).toISOString(),
  }),
  makeEvent(hour + 35 * min, {
    request_id: 'req-w4x5y6',
    decision: 'block',
    reason: 'inject-003',
    latency_ms: 5,
    created_at: new Date(now - hour - 35 * min).toISOString(),
  }),
  makeEvent(2 * hour, {
    request_id: 'req-z7a8b9',
    decision: 'allow',
    latency_ms: 2,
    created_at: new Date(now - 2 * hour).toISOString(),
  }),
  makeEvent(2 * hour + 20 * min, {
    request_id: 'req-c1d2e3',
    decision: 'block',
    reason: BLOCKED_RULES[Math.floor(Math.random() * BLOCKED_RULES.length)],
    latency_ms: 4,
    created_at: new Date(now - 2 * hour - 20 * min).toISOString(),
  }),
  makeEvent(3 * hour, {
    request_id: 'req-f4g5h6',
    decision: 'allow',
    latency_ms: 3,
    created_at: new Date(now - 3 * hour).toISOString(),
  }),
];
