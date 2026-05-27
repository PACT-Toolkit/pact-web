import { type RequestHandler } from 'msw';

import { handlers as accountHandlers } from '@/src/app/account/mock/handlers/account';
import { handlers as auditHandlers } from '@/src/app/audit/mock/handlers/audit';
import { handlers as authHandlers } from '@/src/app/auth/mock/handlers/auth';
import { handlers as benchmarkHandlers } from '@/src/app/benchmark/mock/handlers/benchmark';
import { handlers as classifierHandlers } from '@/src/app/classifier/mock/handlers/classifier';
import { handlers as consensusHandlers } from '@/src/app/consensus/mock/handlers/consensus';
import { handlers as featureHandlers } from '@/src/app/feature_toggle/mock/handlers/feature_toggle';
import { handlers as filterHandlers } from '@/src/app/filter/mock/handlers/filter';
import { handlers as policyHandlers } from '@/src/app/policy/mock/handlers/policy';
import { handlers as redactorHandlers } from '@/src/app/redactor/mock/handlers/redactor';
import { handlers as testLabHandlers } from '@/src/app/test_lab/mock/handlers/test_lab';

export const handlers: RequestHandler[] = [
  ...authHandlers,
  ...accountHandlers,
  ...featureHandlers,
  ...classifierHandlers,
  ...policyHandlers,
  ...redactorHandlers,
  ...filterHandlers,
  ...testLabHandlers,
  ...auditHandlers,
  ...consensusHandlers,
  ...benchmarkHandlers,
];
