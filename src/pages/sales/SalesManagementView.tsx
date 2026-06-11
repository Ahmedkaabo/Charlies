import { TrendingUp } from "lucide-react"

import { useLanguage } from "@/contexts/LanguageContext"
import { useGetBranches } from "@/hooks/useBranches"
import { useSalesRecords, useSalesSummary } from "@/hooks/useSales"
import { getMissingDays } from "@/lib/sales"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

// ── Summary cards ─────────────────────────────────────────────

interface SummaryCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  loading: boolean
}

function SummaryCard({ icon, label, value, sub, loading }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <p className="text-xl font-bold">{value}</p>
        )}
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ── Props ─────────────────────────────────────────────────────

interface SalesManagementViewProps {
  month: number
  year: number
  onSelectBranch: (branchId: string) => void
  branchIds?: string[]
  canTreasuryRead: boolean
}

// ── Component ─────────────────────────────────────────────────

export function SalesManagementView({
  month,
  year,
  onSelectBranch,
  branchIds,
  canTreasuryRead,
}: SalesManagementViewProps) {
  const { t } = useLanguage()

  const { data: allBranches, isLoading: branchesLoading } = useGetBranches()

  // Scope to the user's assigned branches when provided
  const branches = branchIds?.length
    ? (allBranches ?? []).filter((b) => branchIds.includes(b.id))
    : (allBranches ?? [])

  const { summary, isLoading: summaryLoading } = useSalesSummary(
    undefined,
    month,
    year,
    branchIds,
  )

  const { data: allRecords, isLoading: allLoading } = useSalesRecords(
    undefined,
    month,
    year,
    branchIds,
  )

  type BranchRow = {
    id: string
    name: string
    daysFilled: number
    totalRevenue: number
    missingDays: number
    lastEntry: string | null
  }

  function buildBranchRows(): BranchRow[] {
    if (!branches || !allRecords) return []
    return branches.map((branch) => {
      const recs    = allRecords.filter((r) => r.branch_id === branch.id)
      const missing = getMissingDays(recs, month, year)
      const sorted  = [...recs].sort((a, b) => b.date.localeCompare(a.date))
      return {
        id:           branch.id,
        name:         branch.name,
        daysFilled:   recs.length,
        totalRevenue: recs.reduce((s, r) => s + r.revenue, 0),
        missingDays:  missing.length,
        lastEntry:    sorted[0]?.date ?? null,
      }
    })
  }

  const branchRows = buildBranchRows()

  return (
    <div className="space-y-6">
      {/* ── Summary cards ─────────────────────────── */}
      {canTreasuryRead && (
        <div className="grid gap-4">
          <SummaryCard
            icon={<TrendingUp className="h-4 w-4" />}
            label={t("Total Revenue")}
            value={`EGP ${summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            sub={t("All branches")}
            loading={summaryLoading}
          />
        </div>
      )}

      {/* ── Branch table ──────────────────────────── */}
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap sticky left-0 z-10 bg-muted/40 relative after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']">{t("Branch")}</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("Days Filled")}</th>
              {canTreasuryRead && <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("Total Revenue")}</th>}
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("Missing Days")}</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("Last Entry")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {allLoading || branchesLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: canTreasuryRead ? 5 : 4 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : branchRows.length === 0 ? (
              <tr>
                <td colSpan={canTreasuryRead ? 5 : 4} className="px-4 py-8 text-center text-muted-foreground">
                  {t("No branches found")}
                </td>
              </tr>
            ) : (
              branchRows.map((row) => (
                <tr
                  key={row.id}
                  className="group cursor-pointer hover:bg-muted/30"
                  onClick={() => onSelectBranch(row.id)}
                >
                  <td className="px-4 py-3 font-medium sticky left-0 z-10 bg-background sm:group-hover:bg-muted/30 relative after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-border after:content-['']">{row.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.daysFilled}</td>
                  {canTreasuryRead && (
                    <td className="px-4 py-3 text-right tabular-nums">
                      EGP {row.totalRevenue.toLocaleString()}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">
                    {row.missingDays > 0 ? (
                      <span className="text-destructive font-medium">
                        {row.missingDays}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {row.lastEntry ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
