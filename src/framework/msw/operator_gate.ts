import { HttpResponse } from 'msw';

import { getMockUserType } from '@/src/framework/helpers/mock_user_type';

// Mirrors the gateway's audit:stats permission gate for mock handlers:
// operator/admin only. The 'admin' mock persona is the operator stand-in;
// 'auditor' and 'developer' exercise the 403 path so permission-aware empty
// states are reachable in dev:mock without a real gateway. Switch personas
// via the sidebar's mock-user-type dropdown.
//
// Returns the 403 response to hand back, or null when the caller may proceed.
export const operatorOnlyForbiddenResponse = (): Response | null => {
  if (getMockUserType() === 'admin') return null;

  return HttpResponse.json(
    { error: 'insufficient permissions' },
    { status: 403 }
  );
};
