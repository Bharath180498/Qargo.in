import { useMemo } from 'react';
import type { DriverLanguage, TranslationKey } from './translations';
import { translate } from './translations';
import { useDriverUxStore } from '../store/useDriverUxStore';

export function useDriverI18n() {
  const language = useDriverUxStore((state) => state.language);
  const setLanguage = useDriverUxStore((state) => state.setLanguage);

  const t = useMemo(
    () =>
      (key: TranslationKey, params?: Record<string, string | number>) =>
        translate(language, key, params),
    [language]
  );

  return {
    language,
    setLanguage: (next: DriverLanguage) => setLanguage(next),
    t
  };
}
