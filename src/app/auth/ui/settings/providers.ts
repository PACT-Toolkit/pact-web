import {
  OAUTH_PROVIDERS,
  type OAuthProvider,
} from '@/src/app/auth/ui/login/oauth_providers';

// providerMeta resolves a provider id (as returned by pact-auth) to the
// display metadata used by both the login screen and the settings panel.
// Falls back to a Title-Cased id with no icon when pact-auth introduces
// a provider before the web app knows about it — better than blank rows
// or a runtime crash.
export const providerMeta = (
  id: string
): OAuthProvider | { id: string; name: string; iconPath: string } => {
  const known = OAUTH_PROVIDERS.find((p) => p.id === id);
  if (known) return known;

  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    iconPath: '',
  };
};
