'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSWRConfig } from 'swr';

import {
  type Profile,
  getGetAccountProfileKey,
  useGetAccountProfile,
  useUpdateAccountProfile,
} from '@/src/__codegen__/rest/account';
import {
  PROFILE_FIELD_TO_MASK,
  type ProfileFormData,
  profileFormSchema,
} from '@/src/app/account/domain/account_validation_schema';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/src/components/ui/field';
import { Input } from '@/src/components/ui/input';

import { AccountSettingsFormSkeleton } from './AccountSettingsFormSkeleton';

const EMPTY_PROFILE: ProfileFormData = {
  displayName: '',
  avatarUrl: '',
  locale: '',
  timezone: '',
  bio: '',
};

export const AccountSettingsProfileForm = () => {
  const { mutate } = useSWRConfig();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ProfileFormData>({
    resolver: yupResolver(profileFormSchema),
    defaultValues: EMPTY_PROFILE,
  });

  const query = useGetAccountProfile({
    swr: {
      revalidateOnFocus: false,
      onSuccess: (data) => {
        if (data?.status === 200) {
          const p = data.data as Profile;
          form.reset({
            displayName: p.displayName ?? '',
            avatarUrl: p.avatarUrl ?? '',
            locale: p.locale ?? '',
            timezone: p.timezone ?? '',
            bio: p.bio ?? '',
          });
        }
      },
    },
  });
  const profile =
    query.data?.status === 200 ? (query.data.data as Profile) : undefined;
  const isLoading = query.isLoading;
  const loadError = query.error;
  const update = useUpdateAccountProfile({
    swr: { onSuccess: () => void mutate(getGetAccountProfileKey()) },
  });

  const onSubmit = async (values: ProfileFormData) => {
    setServerError(null);
    const dirty = form.formState.dirtyFields as Partial<
      Record<keyof ProfileFormData, boolean>
    >;
    const updateMask = (
      Object.keys(PROFILE_FIELD_TO_MASK) as Array<keyof ProfileFormData>
    )
      .filter((field) => dirty[field])
      .map((field) => PROFILE_FIELD_TO_MASK[field]);

    if (updateMask.length === 0) {
      form.reset(values);

      return;
    }

    try {
      await update.trigger({ ...values, updateMask });
      form.reset(values, { keepDirty: false });
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : 'Could not save your profile. Please try again.'
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          What other people see about you. Stored by pact-account; never shared
          with third parties.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!!loadError && !profile && (
          <p role="alert" className="text-sm text-destructive">
            Could not load your profile. Refresh the page or try again later.
          </p>
        )}
        {isLoading && !profile ? (
          <AccountSettingsFormSkeleton />
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.displayName}>
                <FieldLabel htmlFor="displayName">Display name</FieldLabel>
                <Input
                  id="displayName"
                  autoComplete="name"
                  placeholder="Ada Lovelace"
                  aria-invalid={!!form.formState.errors.displayName}
                  {...form.register('displayName')}
                />
                <FieldDescription>
                  Shown in the sidebar, comments, and audit log.
                </FieldDescription>
                {form.formState.errors.displayName && (
                  <FieldError>
                    {form.formState.errors.displayName.message}
                  </FieldError>
                )}
              </Field>

              <Field data-invalid={!!form.formState.errors.avatarUrl}>
                <FieldLabel htmlFor="avatarUrl">Avatar URL</FieldLabel>
                <Input
                  id="avatarUrl"
                  type="url"
                  inputMode="url"
                  placeholder="https://cdn.example/avatars/ada.png"
                  aria-invalid={!!form.formState.errors.avatarUrl}
                  {...form.register('avatarUrl')}
                />
                <FieldDescription>
                  Optional. Must be HTTPS. Leave empty to fall back to your
                  initials.
                </FieldDescription>
                {form.formState.errors.avatarUrl && (
                  <FieldError>
                    {form.formState.errors.avatarUrl.message}
                  </FieldError>
                )}
              </Field>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <Field data-invalid={!!form.formState.errors.locale}>
                  <FieldLabel htmlFor="locale">Locale</FieldLabel>
                  <Input
                    id="locale"
                    autoComplete="language"
                    placeholder="en-US"
                    aria-invalid={!!form.formState.errors.locale}
                    {...form.register('locale')}
                  />
                  <FieldDescription>BCP 47 tag.</FieldDescription>
                  {form.formState.errors.locale && (
                    <FieldError>
                      {form.formState.errors.locale.message}
                    </FieldError>
                  )}
                </Field>

                <Field data-invalid={!!form.formState.errors.timezone}>
                  <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
                  <Input
                    id="timezone"
                    placeholder="Europe/Copenhagen"
                    aria-invalid={!!form.formState.errors.timezone}
                    {...form.register('timezone')}
                  />
                  <FieldDescription>IANA timezone name.</FieldDescription>
                  {form.formState.errors.timezone && (
                    <FieldError>
                      {form.formState.errors.timezone.message}
                    </FieldError>
                  )}
                </Field>
              </div>

              <Field data-invalid={!!form.formState.errors.bio}>
                <FieldLabel htmlFor="bio">Bio</FieldLabel>
                <textarea
                  id="bio"
                  rows={4}
                  className="rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"
                  placeholder="Designing analytical engines."
                  aria-invalid={!!form.formState.errors.bio}
                  {...form.register('bio')}
                />
                <FieldDescription>
                  Optional. Up to 2000 characters.
                </FieldDescription>
                {form.formState.errors.bio && (
                  <FieldError>{form.formState.errors.bio.message}</FieldError>
                )}
              </Field>

              {serverError && (
                <p role="alert" className="text-sm text-destructive">
                  {serverError}
                </p>
              )}

              <Field orientation="horizontal">
                <Button
                  type="submit"
                  disabled={
                    update.isMutating || !form.formState.isDirty || isLoading
                  }
                >
                  {update.isMutating ? (
                    <>
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden
                      />
                      Saving…
                    </>
                  ) : (
                    'Save changes'
                  )}
                </Button>
                {form.formState.isDirty && !update.isMutating && (
                  <span className="text-xs text-muted-foreground">
                    You have unsaved changes.
                  </span>
                )}
              </Field>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  );
};
