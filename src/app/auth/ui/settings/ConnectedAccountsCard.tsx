'use client';

import { ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import useSWRMutation from 'swr/mutation';

import { OAUTH_PROVIDERS } from '@/src/app/auth/ui/login/oauth_providers';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import {
  AUTH_KEYS,
  ApiError,
  unlinkIdentityFetcher,
} from '@/src/framework/auth/pact_auth/web_mutations';

import { ConnectedIdentityRow } from './ConnectedIdentityRow';
import { type OAuthIdentitySummary } from './types';

type Props = {
  identities: OAuthIdentitySummary[];
  onChanged: () => void;
};

export const ConnectedAccountsCard = ({ identities, onChanged }: Props) => {
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unlinkMutation = useSWRMutation(
    AUTH_KEYS.oauthUnlink,
    unlinkIdentityFetcher,
    {
      onSuccess: onChanged,
      onError: (err: unknown) => {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Could not disconnect provider.'
        );
      },
    }
  );

  const availableProviders = useMemo(() => {
    const connected = new Set(identities.map((i) => i.provider));

    return OAUTH_PROVIDERS.filter((p) => !connected.has(p.id));
  }, [identities]);

  const onDisconnect = async (provider: string) => {
    setError(null);
    setBusyProvider(provider);
    try {
      await unlinkMutation.trigger({ provider });
    } catch {
      // no-op
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          Connected accounts
        </CardTitle>
        <CardDescription>
          Sign in with a federated identity provider. Connected accounts also
          appear as one-click sign-in options on the login page.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {identities.length > 0 && (
          <ul className="flex flex-col gap-2">
            {identities.map((identity) => (
              <ConnectedIdentityRow
                key={identity.provider}
                identity={identity}
                busy={busyProvider === identity.provider}
                onDisconnect={() => onDisconnect(identity.provider)}
              />
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {availableProviders.length > 0 && (
          <div className="flex flex-col gap-2">
            {identities.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Connect another provider:
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {availableProviders.map(({ id, name, iconPath }) => (
                <Button
                  key={id}
                  variant="outline"
                  asChild
                  className="flex h-auto flex-col gap-1.5 py-3"
                >
                  <a href={`/api/auth/oauth/start?provider=${id}`}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      className="size-5"
                      aria-hidden
                    >
                      <path d={iconPath} fill="currentColor" />
                    </svg>
                    <span className="text-sm">Connect {name}</span>
                  </a>
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
