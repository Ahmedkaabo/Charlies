import { useState } from "react"

export type Lang = "en" | "ar"

export function useLanguage() {
  const [lang, setLang] = useState<Lang>(() =>
    (localStorage.getItem("charlies_auth_lang") as Lang) ?? "en"
  )

  function toggle() {
    const next: Lang = lang === "en" ? "ar" : "en"
    localStorage.setItem("charlies_auth_lang", next)
    setLang(next)
  }

  return { lang, toggle, isAr: lang === "ar" }
}
