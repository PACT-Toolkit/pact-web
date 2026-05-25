export interface PolicyEvent {
  id: string;
  requestId: string;
  createdAt: string;
  decision: 'allow' | 'block';
  reason?: string;
  policy: {
    verdict: string;
    agentId?: string;
    toolId?: string;
  };
}

export interface PolicyEventsResponse {
  events: PolicyEvent[];
  total: number;
}
