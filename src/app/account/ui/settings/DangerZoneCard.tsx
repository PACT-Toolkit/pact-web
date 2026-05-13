'use client';

import { ErasureCard } from './ErasureCard';
import { ExportCard } from './ExportCard';

export const DangerZoneCard = () => {
  return (
    <div className="flex flex-col gap-6">
      <ExportCard />
      <ErasureCard />
    </div>
  );
};
