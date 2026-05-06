import { useFeatureContext } from './feature_toggle_context';
import { type FeatureToggle } from './types';

export const useFeatureToggle = (flag: FeatureToggle): boolean => {
  const features = useFeatureContext();

  return features.find((f) => f.id === flag)?.isEnabled ?? false;
};
