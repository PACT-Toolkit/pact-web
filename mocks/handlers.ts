import { type RequestHandler } from 'msw';

import { handlers as accountHandlers } from '@/src/app/account/mock/handlers/account';
import { handlers as auditHandlers } from '@/src/app/audit/mock/handlers/audit';
import { handlers as authHandlers } from '@/src/app/auth/mock/handlers/auth';
import { handlers as benchmarkHandlers } from '@/src/app/benchmark/mock/handlers/benchmark';
import { handlers as classifierHandlers } from '@/src/app/classifier/mock/handlers/classifier';
import { handlers as consensusHandlers } from '@/src/app/consensus/mock/handlers/consensus';
import { handlers as filesHandlers } from '@/src/app/files/mock/handlers/files';
import { handlers as filterHandlers } from '@/src/app/filter/mock/handlers/filter';
import { handlers as gatewayHandlers } from '@/src/app/gateway/mock/handlers/gateway';
import { handlers as policyHandlers } from '@/src/app/policy/mock/handlers/policy';
import { handlers as redactorHandlers } from '@/src/app/redactor/mock/handlers/redactor';
import { handlers as testLabHandlers } from '@/src/app/test_lab/mock/handlers/test_lab';

export const handlers: RequestHandler[] = [
  ...authHandlers,
  ...accountHandlers,
  ...classifierHandlers,
  ...policyHandlers,
  ...redactorHandlers,
  ...filterHandlers,
  ...filesHandlers,
  ...gatewayHandlers,
  ...testLabHandlers,
  ...auditHandlers,
  ...consensusHandlers,
  ...benchmarkHandlers,
];
