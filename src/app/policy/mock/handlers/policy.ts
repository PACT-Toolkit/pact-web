import { http, HttpResponse, type RequestHandler } from 'msw';
import { v4 as uuidv4 } from 'uuid';

import { type PolicyEvent } from '@/src/app/policy/domain/policy_event';

const min = 60_000;
const hour = 60 * min;

const policyEvents: PolicyEvent[] = [
  {
    id: uuidv4(),
    requestId: 'req-pol-001',
    createdAt: new Date(Date.now() - 3 * min).toISOString(),
    decision: 'allow',
    reason: 'policy_token_allowed',
    policy: {
      verdict: 'allowed',
      agentId: 'agent-alpha',
      toolId: 'tool-search',
    },
  },
  {
    id: uuidv4(),
    requestId: 'req-pol-002',
    createdAt: new Date(Date.now() - 10 * min).toISOString(),
    decision: 'block',
    reason: 'policy_token_denied',
    policy: { verdict: 'denied', agentId: 'agent-alpha', toolId: 'tool-exec' },
  },
  {
    id: uuidv4(),
    requestId: 'req-pol-003',
    createdAt: new Date(Date.now() - 22 * min).toISOString(),
    decision: 'allow',
    reason: 'policy_token_allowed',
    policy: { verdict: 'allowed', agentId: 'agent-beta', toolId: 'tool-read' },
  },
  {
    id: uuidv4(),
    requestId: 'req-pol-004',
    createdAt: new Date(Date.now() - 45 * min).toISOString(),
    decision: 'block',
    reason: 'policy_token_denied',
    policy: {
      verdict: 'denied',
      agentId: 'agent-gamma',
      toolId: 'tool-delete',
    },
  },
  {
    id: uuidv4(),
    requestId: 'req-pol-005',
    createdAt: new Date(Date.now() - hour).toISOString(),
    decision: 'allow',
    reason: 'policy_token_allowed',
    policy: {
      verdict: 'allowed',
      agentId: 'agent-beta',
      toolId: 'tool-search',
    },
  },
  {
    id: uuidv4(),
    requestId: 'req-pol-006',
    createdAt: new Date(Date.now() - 2 * hour).toISOString(),
    decision: 'block',
    reason: 'policy_token_denied',
    policy: { verdict: 'denied', agentId: 'agent-alpha', toolId: 'tool-exec' },
  },
  {
    id: uuidv4(),
    requestId: 'req-pol-007',
    createdAt: new Date(Date.now() - 3 * hour).toISOString(),
    decision: 'allow',
    reason: 'policy_token_allowed',
    policy: { verdict: 'allowed', agentId: 'agent-gamma', toolId: 'tool-read' },
  },
];

export const handlers: RequestHandler[] = [
  http.get('*/v1/audit/policy-events', () =>
    HttpResponse.json({ events: policyEvents, total: policyEvents.length })
  ),
];
