import { useState, useMemo } from "react"
import { format } from "date-fns"
import { ChevronLeft, TrendingUp } from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { useGetBranches } from "@/hooks/useBranches"
import { useMyBranches } from "@/hooks/useAttendance"
import { useUserPermissions } from "@/hooks/usePermissions"
import { SalesManagementView } from "@/pages/sales/SalesManagementView"
import { SalesBranchView } from "@/pages/sales/SalesBranchView"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ── Month options ─────────────────────────────────────────────

function generateMonthOptions() {
  const start = new Date(2026, 5, 1)
  const now   = new Date()
  const opts: { month: number; year: number; label: string; value: string }[] = []
  for (
    let d = new Date(now.getFullYear(), now.getMonth(), 1);
    d >= start;
    d.setMonth(d.getMonth() - 1)
  ) {
    opts.push({
      month: d.getMonth() + 1,
      year:  d.getFullYear(),
      label: format(new Date(d), "MMMM yyyy"),
      value: `${d.getFullYear()}-${d.getMonth() + 1}`,
    })
  }
  return opts
}

const MONTH_OPTIONS = generateMonthOptions()

// ── Page ──────────────────────────────────────────────────────

export function SalesPage() {
  const { profile } = useAuth()

  const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTIONS[0].value)
  const [drillBranchId, setDrillBranchId] = useState<string | null>(null)

  const { month, year } = useMemo(() => {
    const opt = MONTH_OPTIONS.find((o) => o.value === selectedMonth) ?? MONTH_OPTIONS[0]
    return { month: opt.month, year: opt.year }
  }, [selectedMonth])

  const { data: allBranches = [], isLoading: allBranchesLoading } = useGetBranches()
  const { data: myBranches  = [], isLoading: myBranchesLoading  } = useMyBranches(profile?.id)
  const { canRead } = useUserPermissions()
  const canTreasuryRead = canRead("treasury_transfers")

  // The branches this user can access: their assignments, or all branches if none (admin/owner)
  const branchList = myBranches.length > 0 ? myBranches : allBranches
  const myBranchIds = myBranches.length > 0 ? myBranches.map((b) => b.id) : undefined

  // ── Loading ────────────────────────────────────────────────

  if (myBranchesLoading || allBranchesLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // ── No branches assigned ───────────────────────────────────

  if (branchList.length === 0) {
    return (
      <div className="p-4 md:p-6 flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
        <TrendingUp className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">You're not assigned to any branch yet.</p>
      </div>
    )
  }

  // ── Shared month selector ──────────────────────────────────

  const monthSelect = (
    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
      <SelectTrigger className="w-[150px] h-8 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MONTH_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  // ── Single branch → go straight to branch view ─────────────

  if (branchList.length === 1) {
    const branch = branchList[0]
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{branch.name}</h1>
          {monthSelect}
        </div>
        <SalesBranchView branchId={branch.id} branchName={branch.name} month={month} year={year} />
      </div>
    )
  }

  // ── Multi-branch: drilled into a specific branch ───────────

  const drilledBranch = drillBranchId
    ? (branchList.find((b) => b.id === drillBranchId) ?? null)
    : null

  if (drilledBranch) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setDrillBranchId(null)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">{drilledBranch.name}</h1>
            {monthSelect}
          </div>
        </div>
        <SalesBranchView
          branchId={drilledBranch.id}
          branchName={drilledBranch.name}
          month={month}
          year={year}
        />
      </div>
    )
  }

  // ── Multi-branch: management overview ──────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Sales</h1>
        {monthSelect}
      </div>
      <SalesManagementView
        month={month}
        year={year}
        onSelectBranch={setDrillBranchId}
        branchIds={myBranchIds}
        canTreasuryRead={canTreasuryRead}
      />
    </div>
  )
}
