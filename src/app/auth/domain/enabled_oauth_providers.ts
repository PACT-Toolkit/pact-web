import 'server-only';

import {
  OAUTH_PROVIDERS,
  type OAuthProvider,
} from '@/src/app/auth/domain/oauth_providers';

// Which OAuth providers this deployment offers is a server-side runtime
// decision (PACT_AUTH_OAUTH_PROVIDERS), not a build-time one, so a single
// build can serve deployments with different provider apps registered.
//   unset or empty        -> every known provider
//   `none` (any case)     -> no provider
//   comma-separated ids   -> those providers, in canonical order; unknown
//                            ids are ignored
// Never expose this through a NEXT_PUBLIC_ variable: pages read it per
// request and pass the result down as props.
export const parseEnabledOAuthProviders = (
  raw: string | undefined
): OAuthProvider[] => {
  const value = raw?.trim().toLowerCase() ?? '';
  if (value === '') return OAUTH_PROVIDERS;
  if (value === 'none') return [];

  const wanted = new Set(value.split(',').map((id) => id.trim()));

  return OAUTH_PROVIDERS.filter((p) => wanted.has(p.id));
};

export const getEnabledOAuthProviders = (): OAuthProvider[] =>
  parseEnabledOAuthProviders(process.env.PACT_AUTH_OAUTH_PROVIDERS);

export const isOAuthProviderEnabled = (id: string): boolean =>
  getEnabledOAuthProviders().some((p) => p.id === id);
