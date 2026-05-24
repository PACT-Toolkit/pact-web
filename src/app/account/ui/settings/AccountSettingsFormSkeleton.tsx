'use client';

import { FieldGroup } from '@/src/components/ui/field';
import { Skeleton } from '@/src/components/ui/skeleton';

export const AccountSettingsFormSkeleton = () => (
  <FieldGroup>
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full" />
      </div>
    ))}
  </FieldGroup>
);
