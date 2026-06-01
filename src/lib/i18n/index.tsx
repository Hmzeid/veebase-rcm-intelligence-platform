'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { en } from './translations/en';
import { ar } from './translations/ar';

export type Locale = 'en' | 'ar';

type TranslationMap = typeof en;

const translations: Record<Locale, TranslationMap> = { en, ar };

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationMap;
  isRTL: boolean;
  dir: 'ltr' | 'rtl';
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: en,
  isRTL: false,
  dir: 'ltr',
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(
    (typeof window !== 'undefined' && localStorage.getItem('veebase-locale') as Locale) || 'en'
  );

  const handleSetLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem('veebase-locale', newLocale);
    document.documentElement.dir = newLocale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLocale;
  }, []);

  const isRTL = locale === 'ar';
  const dir = isRTL ? 'rtl' as const : 'ltr' as const;
  const t = translations[locale];

  // Set initial direction on mount
  React.useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = locale;
  }, [dir, locale]);

  const value = useMemo(() => ({
    locale,
    setLocale: handleSetLocale,
    t,
    isRTL,
    dir,
  }), [locale, handleSetLocale, t, isRTL, dir]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export { I18nContext };
