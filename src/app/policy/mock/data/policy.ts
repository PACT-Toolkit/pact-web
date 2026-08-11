// Mock-mode data for the /policy console: the evaluated capability-token
// decision feed (PolicyEvent, read-only in mock mode - the real feed is
// gateway-produced) and the authored rule set (PolicyRule, mutated by the
// create/publish/revoke handlers in mock/handlers/policy.ts). Both go
// through db so a session's rule edits are visible from devtools and reset
// between Vitest runs, same as every other stateful feature's mock data -
// see the pact-mock-data skill's "Don't bypass db for mutations" rule.
import { v4 as uuidv4 } from 'uuid';

import { type DB } from '@/mocks/data/dbFactory';
import { type PolicyEvent } from '@/src/app/policy/domain/policy_event';
import { type PolicyRule } from '@/src/app/policy/domain/policy_rule';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const mockPolicyEvent = (
  overrides: Partial<PolicyEvent>
): PolicyEvent => ({
  id: uuidv4(),
  requestId: 'req-pol-000',
  createdAt: new Date().toISOString(),
  decision: 'allow',
  reason: 'policy_token_allowed',
  policy: { verdict: 'allowed', agentId: 'agent-alpha', toolId: 'tool-search' },
  ...overrides,
});

export const mockPolicyRule = (overrides: Partial<PolicyRule>): PolicyRule => {
  const ts = new Date().toISOString();

  return {
    id: uuidv4(),
    name: 'unnamed-rule',
    status: 'draft',
    version: 1,
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
};

export const createPolicyEventsMockData = (db: DB): void => {
  const now = Date.now();

  db.policyEvents.create({
    requestId: 'req-pol-001',
    createdAt: new Date(now - 3 * MINUTE).toISOString(),
    decision: 'allow',
    reason: 'policy_token_allowed',
    policy: {
      verdict: 'allowed',
      agentId: 'agent-alpha',
      toolId: 'tool-search',
    },
  });
  db.policyEvents.create({
    requestId: 'req-pol-002',
    createdAt: new Date(now - 10 * MINUTE).toISOString(),
    decision: 'block',
    reason: 'policy_token_denied',
    policy: { verdict: 'denied', agentId: 'agent-alpha', toolId: 'tool-exec' },
  });
  db.policyEvents.create({
    requestId: 'req-pol-003',
    createdAt: new Date(now - 22 * MINUTE).toISOString(),
    decision: 'allow',
    reason: 'policy_token_allowed',
    policy: { verdict: 'allowed', agentId: 'agent-beta', toolId: 'tool-read' },
  });
  db.policyEvents.create({
    requestId: 'req-pol-004',
    createdAt: new Date(now - 45 * MINUTE).toISOString(),
    decision: 'block',
    reason: 'policy_token_denied',
    policy: {
      verdict: 'denied',
      agentId: 'agent-gamma',
      toolId: 'tool-delete',
    },
  });
  db.policyEvents.create({
    requestId: 'req-pol-005',
    createdAt: new Date(now - HOUR).toISOString(),
    decision: 'allow',
    reason: 'policy_token_allowed',
    policy: {
      verdict: 'allowed',
      agentId: 'agent-beta',
      toolId: 'tool-search',
    },
  });
  db.policyEvents.create({
    requestId: 'req-pol-006',
    createdAt: new Date(now - 2 * HOUR).toISOString(),
    decision: 'block',
    reason: 'policy_token_denied',
    policy: { verdict: 'denied', agentId: 'agent-alpha', toolId: 'tool-exec' },
  });
  db.policyEvents.create({
    requestId: 'req-pol-007',
    createdAt: new Date(now - 3 * HOUR).toISOString(),
    decision: 'allow',
    reason: 'policy_token_allowed',
    policy: { verdict: 'allowed', agentId: 'agent-gamma', toolId: 'tool-read' },
  });
};

// Seeded with a couple of rules so the list renders non-empty on first load
// in mock mode.
export const createPolicyRulesMockData = (db: DB): void => {
  const now = Date.now();

  db.policyRules.create({
    name: 'block-credential-exfil',
    status: 'published',
    version: 2,
    createdAt: new Date(now - 2 * HOUR).toISOString(),
    updatedAt: new Date(now - 30 * MINUTE).toISOString(),
  });
  db.policyRules.create({
    name: 'flag-pii-in-prompts',
    status: 'draft',
    version: 1,
    createdAt: new Date(now - 6 * HOUR).toISOString(),
    updatedAt: new Date(now - 6 * HOUR).toISOString(),
  });
};
