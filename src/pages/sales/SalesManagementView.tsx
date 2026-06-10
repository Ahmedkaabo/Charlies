import { TrendingUp } from "lucide-react"

import { useGetBranches } from "@/hooks/useBranches"
import { useSalesRecords, useSalesSummary } from "@/hooks/useSales"
import { getMissingDays } from "@/lib/sales"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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
            label="Total Revenue"
            value={`EGP ${summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            sub="All branches"
            loading={summaryLoading}
          />
        </div>
      )}

      {/* ── Branch table ──────────────────────────── */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead>
              <TableHead className="text-right">Days Filled</TableHead>
              {canTreasuryRead && <TableHead className="text-right">Total Revenue</TableHead>}
              <TableHead className="text-right">Missing Days</TableHead>
              <TableHead className="text-right">Last Entry</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allLoading || branchesLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: canTreasuryRead ? 5 : 4 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : branchRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canTreasuryRead ? 5 : 4}
                  className="text-center text-muted-foreground py-8"
                >
                  No branches found
                </TableCell>
              </TableRow>
            ) : (
              branchRows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onSelectBranch(row.id)}
                >
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right">{row.daysFilled}</TableCell>
                  {canTreasuryRead && (
                    <TableCell className="text-right tabular-nums">
                      EGP {row.totalRevenue.toLocaleString()}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {row.missingDays > 0 ? (
                      <span className="text-destructive font-medium">
                        {row.missingDays}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {row.lastEntry ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
