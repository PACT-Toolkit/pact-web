'use client';

import { createContext, useContext, type ReactNode } from 'react';

import { useGetFeatures } from '@/src/__codegen__/rest/feature';
import { type Feature } from '@/src/__codegen__/rest/feature/types';
import { isProduction } from '@/src/framework/helpers/environment';

import { DevFeaturePanel } from '../ui/DevFeaturePanel';

const FeatureContext = createContext<Feature[]>([]);

export const useFeatureContext = () => useContext(FeatureContext);

export const FeatureToggleProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { data } = useGetFeatures();
  const features = data?.data ?? [];

  return (
    <FeatureContext.Provider value={features}>
      {children}
      {!isProduction() && <DevFeaturePanel />}
    </FeatureContext.Provider>
  );
};
