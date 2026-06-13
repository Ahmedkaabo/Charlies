import { useState, useCallback } from "react"
import { SHEET_URL, SHEET_CELL, SHEET_TAB } from "@/config/salesCheck"

function extractSpreadsheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return m ? m[1] : null
}

async function fetchCellValue(url: string, cell: string, tab: string): Promise<number> {
  const id = extractSpreadsheetId(url)
  if (!id) throw new Error("Invalid Google Sheets URL in salesCheck config")

  const range = tab ? `${tab}!${cell}` : cell
  const endpoint =
    `https://docs.google.com/spreadsheets/d/${id}/gviz/tq` +
    `?tqx=out:csv&range=${encodeURIComponent(range)}`

  const res = await fetch(endpoint)
  if (!res.ok) throw new Error(`Google Sheets responded with ${res.status}`)

  // The gviz CSV response wraps the value in double-quotes: "EGP 150,000" or "150000"
  const raw = (await res.text())
    .trim()
    .replace(/^"+|"+$/g, "")  // strip surrounding quotes
    .replace(/[A-Za-zء-ي،‏\s]/g, "") // strip letters (EGP, ج.م., etc.) and spaces
    .replace(/,/g, "")         // strip thousands commas
  const num = parseFloat(raw)
  if (isNaN(num)) throw new Error(`Cell ${cell} contains "${raw}", expected a number`)
  return num
}

/** Values within ±TOLERANCE are treated as a match */
const TOLERANCE = 300

// ── State types ───────────────────────────────────────────────────

export type CheckState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "match";    sheetValue: number; appTotal: number; diff: number }
  | { status: "mismatch"; sheetValue: number; appTotal: number; diff: number }
  | { status: "error";    message: string }

// ── Hook ──────────────────────────────────────────────────────────

export function useSheetsCheck(appTotal: number) {
  const [state, setState] = useState<CheckState>({ status: "idle" })

  const run = useCallback(async () => {
    setState({ status: "loading" })
    try {
      const sheetValue = await fetchCellValue(SHEET_URL, SHEET_CELL, SHEET_TAB)
      const diff = appTotal - sheetValue
      const match = Math.abs(diff) <= TOLERANCE
      setState(match
        ? { status: "match",    sheetValue, appTotal, diff }
        : { status: "mismatch", sheetValue, appTotal, diff },
      )
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Unknown error" })
    }
  }, [appTotal])

  const reset = useCallback(() => setState({ status: "idle" }), [])

  return { state, run, reset, cell: SHEET_CELL }
}
