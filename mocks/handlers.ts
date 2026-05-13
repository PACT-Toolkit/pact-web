import { type RequestHandler } from 'msw';

import { handlers as accountHandlers } from '@/src/app/account/mock/handlers';
import { handlers as auditHandlers } from '@/src/app/audit/mock/handlers';
import { handlers as authHandlers } from '@/src/app/auth/mock/handlers';
import { handlers as benchmarkHandlers } from '@/src/app/benchmark/mock/handlers';
import { handlers as classifierHandlers } from '@/src/app/classifier/mock/handlers';
import { handlers as consensusHandlers } from '@/src/app/consensus/mock/handlers';
import { handlers as featureHandlers } from '@/src/app/feature_toggle/mock/handlers';
import { handlers as filterHandlers } from '@/src/app/filter/mock/handlers';
import { handlers as policyHandlers } from '@/src/app/policy/mock/handlers';
import { handlers as redactorHandlers } from '@/src/app/redactor/mock/handlers';

export const handlers: RequestHandler[] = [
  ...authHandlers,
  ...accountHandlers,
  ...featureHandlers,
  ...classifierHandlers,
  ...policyHandlers,
  ...redactorHandlers,
  ...filterHandlers,
  ...auditHandlers,
  ...consensusHandlers,
  ...benchmarkHandlers,
];
