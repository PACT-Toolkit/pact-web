'use client';

import { AccountSettingsErasureCard } from './AccountSettingsErasureCard';
import { AccountSettingsExportCard } from './AccountSettingsExportCard';

export const AccountSettingsDangerZoneCard = () => {
  return (
    <div className="flex flex-col gap-6">
      <AccountSettingsExportCard />
      <AccountSettingsErasureCard />
    </div>
  );
};
