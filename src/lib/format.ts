import { useLanguage } from "@/contexts/LanguageContext"

const CURRENCY_SYMBOLS: Record<string, Record<string, string>> = {
  ar: { EGP: "ج.م.", USD: "$" },
  en: { EGP: "EGP", USD: "$" },
}

export function currencySymbol(code: string, lang: string): string {
  return CURRENCY_SYMBOLS[lang]?.[code] ?? code
}

export function fmtMoney(n: number, code: string, lang: string, fractions = 0): string {
  const locale = lang === "ar" ? "ar-EG" : "en-EG"
  const num = n.toLocaleString(locale, {
    minimumFractionDigits: fractions,
    maximumFractionDigits: fractions,
  })
  const sym = currencySymbol(code, lang)
  return lang === "ar" ? `${num} ${sym}` : `${sym} ${num}`
}

export function fmtNum(n: number, lang: string, opts?: Intl.NumberFormatOptions): string {
  const locale = lang === "ar" ? "ar-EG" : "en-EG"
  return n.toLocaleString(locale, opts)
}

export function useFormatters() {
  const { language } = useLanguage()
  return {
    egp:    (n: number, fractions = 0)                     => fmtMoney(n, "EGP", language, fractions),
    money:  (n: number, code = "EGP", fractions = 0)       => fmtMoney(n, code, language, fractions),
    num:    (n: number, opts?: Intl.NumberFormatOptions)    => fmtNum(n, language, opts),
    sym:    (code: string)                                  => currencySymbol(code, language),
  }
}

/** Returns name_ar when in Arabic mode and it exists, otherwise name. */
export function useLocalName() {
  const { isRTL } = useLanguage()
  return (name: string, name_ar?: string | null): string =>
    isRTL && name_ar ? name_ar : name
}
