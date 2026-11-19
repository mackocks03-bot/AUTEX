import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { translations, type Lang } from "@/i18n/translations";

type LanguageContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: typeof translations.en;
  toggle: () => void;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Always lock language to English
  const lang: Lang = "en";

  useEffect(() => {
    localStorage.removeItem("mwm_lang");
    document.documentElement.lang = "en";
  }, []);

  const t = translations.en;

  const value = useMemo(
    () => ({
      lang,
      setLang: () => {},
      t,
      toggle: () => {},
    }),
    [t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
