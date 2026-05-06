'use client';

import { Settings, X } from 'lucide-react';
import { useState } from 'react';
import { mutate } from 'swr';

import {
  getGetFeaturesKey,
  updateFeature,
} from '@/src/__codegen__/rest/feature/fetchers';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { Switch } from '@/src/components/ui/switch';

import { useFeatureContext } from '../domain/feature_toggle_context';

export const DevFeaturePanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const features = useFeatureContext();

  const handleToggle = async (id: string, isEnabled: boolean) => {
    await updateFeature(id, { isEnabled });
    await mutate(getGetFeaturesKey());
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {isOpen && (
        <div className="w-72 rounded-lg border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">Feature Flags</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsOpen(false)}
            >
              <X size={14} />
            </Button>
          </div>
          <div className="divide-y">
            {features.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                No features configured.
              </p>
            ) : (
              [...features]
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <Label htmlFor={f.id} className="cursor-pointer text-sm">
                      {f.title}
                    </Label>
                    <Switch
                      id={f.id}
                      checked={f.isEnabled}
                      onCheckedChange={(checked) => handleToggle(f.id, checked)}
                    />
                  </div>
                ))
            )}
          </div>
        </div>
      )}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen((v) => !v)}
        className="h-10 w-10 rounded-full shadow-md"
        aria-label={
          isOpen ? 'Close feature flags panel' : 'Open feature flags panel'
        }
      >
        <Settings size={16} />
      </Button>
    </div>
  );
};
