/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { translations, type Language } from "@/i18n/translations"
import { DirectionProvider } from "@/components/ui/direction"

type LanguageContextType = {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
  isRTL: boolean
}

const LanguageContext = React.createContext<LanguageContextType | undefined>(undefined)

const STORAGE_KEY = "lang"

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === "ar" || stored === "en" ? stored : "ar"
  })

  const setLanguage = React.useCallback((lang: Language) => {
    localStorage.setItem(STORAGE_KEY, lang)
    setLanguageState(lang)
  }, [])

  const isRTL = language === "ar"

  React.useEffect(() => {
    const root = document.documentElement
    root.dir = isRTL ? "rtl" : "ltr"
    root.lang = language
  }, [language, isRTL])

  const t = React.useCallback(
    (key: string): string => translations[language][key] ?? key,
    [language]
  )

  const value = React.useMemo(
    () => ({ language, setLanguage, t, isRTL }),
    [language, setLanguage, t, isRTL]
  )

  return (
    <LanguageContext.Provider value={value}>
      <DirectionProvider dir={isRTL ? "rtl" : "ltr"}>
        {children}
      </DirectionProvider>
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = React.useContext(LanguageContext)
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider")
  return ctx
}
