'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useSWRConfig } from 'swr';

import {
  type Preferences,
  getGetAccountPreferencesKey,
  useGetAccountPreferences,
  useUpdateAccountPreferences,
} from '@/src/__codegen__/rest/account';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from '@/src/components/ui/field';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Switch } from '@/src/components/ui/switch';

import { type ToggleConfig, TOGGLES } from './helpers';

export const AccountSettingsPreferencesForm = () => {
  const { mutate } = useSWRConfig();
  const query = useGetAccountPreferences();
  const preferences =
    query.data?.status === 200 ? (query.data.data as Preferences) : undefined;
  const isLoading = query.isLoading;
  const loadError = query.error;
  const update = useUpdateAccountPreferences({
    swr: { onSuccess: () => void mutate(getGetAccountPreferencesKey()) },
  });
  const [busyField, setBusyField] = useState<ToggleConfig['field'] | null>(
    null
  );
  const [serverError, setServerError] = useState<string | null>(null);

  const onToggle = async (cfg: ToggleConfig, value: boolean) => {
    if (!preferences) return;
    setServerError(null);
    setBusyField(cfg.field);
    try {
      await update.trigger({
        marketingEmail:
          cfg.field === 'marketingEmail' ? value : preferences.marketingEmail,
        productEmail:
          cfg.field === 'productEmail' ? value : preferences.productEmail,
        updateMask: [cfg.mask],
      });
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : 'Could not update preferences. Please try again.'
      );
    } finally {
      setBusyField(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          What we email you about. Transactional messages (password resets,
          security alerts) are not configurable — they go to the email on your
          account regardless.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!!loadError && !preferences && (
          <p role="alert" className="text-sm text-destructive">
            Could not load your preferences. Refresh the page or try again
            later.
          </p>
        )}
        {isLoading && !preferences ? (
          <FieldGroup>
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </FieldGroup>
        ) : preferences ? (
          <FieldGroup>
            {TOGGLES.map((cfg) => {
              const checked = preferences[cfg.field];
              const busy = busyField === cfg.field;

              return (
                <Field key={cfg.field} orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>{cfg.title}</FieldTitle>
                    <FieldDescription>{cfg.description}</FieldDescription>
                  </FieldContent>
                  <div className="flex items-center gap-2">
                    {busy && (
                      <Loader2
                        className="h-4 w-4 animate-spin text-muted-foreground"
                        aria-hidden
                      />
                    )}
                    <Switch
                      checked={checked}
                      disabled={busy}
                      aria-label={cfg.title}
                      onCheckedChange={(next) => void onToggle(cfg, next)}
                    />
                  </div>
                </Field>
              );
            })}
            {serverError && (
              <p role="alert" className="text-sm text-destructive">
                {serverError}
              </p>
            )}
          </FieldGroup>
        ) : null}
      </CardContent>
    </Card>
  );
};
