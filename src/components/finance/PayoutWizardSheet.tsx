import { useState, useMemo, useEffect } from "react"
import { format } from "date-fns"
import { Loader2, Building2, ArrowRight, History } from "lucide-react"
import { toast } from "sonner"

import { useAllBranchFinancials, useRentPaidBranches } from "@/hooks/useFinance"
import { useAllBranchOwnership } from "@/hooks/useBranchOwnership"
import { useGetOwners, useAllOwnerAssignments } from "@/hooks/useOwners"
import {
  useCreatePayoutRun,
  useUpdatePayoutRun,
  usePayoutSettings,
  type PayoutRunInput,
} from "@/hooks/usePayoutRuns"
import { useAuth } from "@/hooks/useAuth"
import { useLanguage } from "@/contexts/LanguageContext"
import { cn } from "@/lib/utils"
import { useFormatters } from "@/lib/format"
import type { Branch } from "@/types/branch"
import type { DeductionType, PayoutRunFull } from "@/types/finance"

import { ChevronForward, ChevronBack } from "@/components/ui/rtl-chevron"
import { Button }    from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Input }     from "@/components/ui/input"
import { Label }     from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton }  from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// ── Helpers ───────────────────────────────────────────────────

function num(s: string) {
  return Math.max(0, parseFloat(s) || 0)
}

// ── Branch deduction config ───────────────────────────────────

interface BranchConfig {
  branchId:               string
  branchName:             string
  rentType:               DeductionType
  rentValue:              string
  favorType:              DeductionType
  favorValue:             string
  companyShareType:       DeductionType
  companyShareValue:      string
  mgmtFeeType:            DeductionType
  mgmtFeeValue:           string
  snapshotSales:          number
  snapshotNetProfit:      number
  snapshotAdjustments:    number
  snapshotAdjustedProfit: number
}

// Rent and Favor are cut from total sales.
// Company share and mgmt fee are cut from adjusted profit.
function computeAmounts(cfg: BranchConfig) {
  const sales          = cfg.snapshotSales
  const adjustedProfit = cfg.snapshotAdjustedProfit

  const rent = cfg.rentType === "fixed"
    ? num(cfg.rentValue)
    : (sales * num(cfg.rentValue)) / 100

  const favor = cfg.favorType === "fixed"
    ? num(cfg.favorValue)
    : (sales * num(cfg.favorValue)) / 100

  const companyShare = cfg.companyShareType === "fixed"
    ? num(cfg.companyShareValue)
    : (Math.max(0, adjustedProfit) * num(cfg.companyShareValue)) / 100

  const mgmtFee = cfg.mgmtFeeType === "fixed"
    ? num(cfg.mgmtFeeValue)
    : (Math.max(0, adjustedProfit) * num(cfg.mgmtFeeValue)) / 100

  const distributable = adjustedProfit - rent - favor - companyShare - mgmtFee
  return { rent, favor, companyShare, mgmtFee, distributable }
}

// ── Deduction row — fused select + input in one pill ─────────

function DeductionRow({
  label, type, value, fixedLabel, pctLabel, onTypeChange, onValueChange, amount, basis,
  disabled, disabledNote,
}: {
  label:          string
  type:           DeductionType
  value:          string
  fixedLabel:     string
  pctLabel:       string
  onTypeChange:   (v: DeductionType) => void
  onValueChange:  (v: string) => void
  amount:         number
  basis:          number
  disabled?:      boolean
  disabledNote?:  string
}) {
  const fmt = useFormatters()
  const { t } = useLanguage()
  return (
    <div className="space-y-1.5">
      <Label className={cn(
        "text-xs uppercase tracking-wide",
        disabled ? "text-muted-foreground/50" : "text-muted-foreground",
      )}>
        {label}
      </Label>

      {disabled ? (
        <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-muted/40 px-3 text-sm text-muted-foreground/60 cursor-not-allowed select-none">
          <span className="flex-1 truncate">{disabledNote ?? t("Paid via adjustment")}</span>
          <span className="tabular-nums text-xs shrink-0">{fmt.egp(0)}</span>
        </div>
      ) : (
        <ButtonGroup className="w-full">
          <Select value={type} onValueChange={(v) => onTypeChange(v as DeductionType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">{fixedLabel}</SelectItem>
              <SelectItem value="percentage">{pctLabel}</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={type === "fixed" ? "100" : "0.1"}
            placeholder="0"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </ButtonGroup>
      )}

      {!disabled && (
        <p className="text-xs text-muted-foreground ps-1">
          {t("Deducted:")}{" "}
          <span className={cn("font-medium", amount > 0 ? "text-destructive" : "text-foreground")}>
            {fmt.egp(amount)}
          </span>
          {type === "percentage" && basis > 0 && (
            <span className="ms-1 text-muted-foreground/70">
              ({num(value).toFixed(1)}% of {fmt.egp(basis)})
            </span>
          )}
        </p>
      )}
    </div>
  )
}

// ── Branch config card ────────────────────────────────────────

function BranchConfigCard({
  config,
  loading,
  rentPaid,
  onChange,
}: {
  config:    BranchConfig
  loading:   boolean
  rentPaid:  boolean
  onChange:  (field: keyof BranchConfig, value: string) => void
}) {
  const { rent, favor, companyShare, mgmtFee } = computeAmounts(config)
  const fmt = useFormatters()
  const { t } = useLanguage()

  function set(field: keyof BranchConfig) {
    return (v: string) => onChange(field, v)
  }

  const hasAdjustments = config.snapshotAdjustments !== 0

  return (
    <div className="rounded-xl border bg-card">
      {/* Branch header */}
      <div className="flex items-start gap-3 px-4 py-3 border-b">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
          <Building2 className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{config.branchName}</p>
          {loading ? (
            <Skeleton className="h-3 w-48 mt-1" />
          ) : (
            <div className="mt-0.5 space-y-0.5">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{t("Sales")} <span className="font-medium text-foreground">{fmt.egp(config.snapshotSales)}</span></span>
                <span>{t("Net Profit")} <span className="font-medium text-foreground">{fmt.egp(config.snapshotNetProfit)}</span></span>
              </div>
              {hasAdjustments && (
                <div className="text-xs text-muted-foreground">
                  {t("Adjustments")}{" "}
                  <span className={cn(
                    "font-medium",
                    config.snapshotAdjustments >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive",
                  )}>
                    {config.snapshotAdjustments >= 0 ? "+" : ""}
                    {fmt.egp(config.snapshotAdjustments)}
                  </span>
                </div>
              )}
              <div className="text-xs font-semibold">
                {t("Adjusted Profit")}{" "}
                <span className={cn(
                  config.snapshotAdjustedProfit >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive",
                )}>
                  {fmt.egp(config.snapshotAdjustedProfit)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <DeductionRow
          label={t("Rent")}
          type={config.rentType}
          value={config.rentValue}
          fixedLabel={t("Fixed")}
          pctLabel={t("% of sales")}
          onTypeChange={(v) => onChange("rentType", v)}
          onValueChange={set("rentValue")}
          amount={rentPaid ? 0 : rent}
          basis={config.snapshotSales}
          disabled={rentPaid}
          disabledNote={t("Paid via withdrawal adjustment")}
        />

        <DeductionRow
          label={t("Favor")}
          type={config.favorType}
          value={config.favorValue}
          fixedLabel={t("Fixed")}
          pctLabel={t("% of sales")}
          onTypeChange={(v) => onChange("favorType", v)}
          onValueChange={set("favorValue")}
          amount={favor}
          basis={config.snapshotSales}
        />

        <DeductionRow
          label={t("Company Share")}
          type={config.companyShareType}
          value={config.companyShareValue}
          fixedLabel={t("Fixed")}
          pctLabel={t("% of adj. profit")}
          onTypeChange={(v) => onChange("companyShareType", v)}
          onValueChange={set("companyShareValue")}
          amount={companyShare}
          basis={Math.max(0, config.snapshotAdjustedProfit)}
        />

        <DeductionRow
          label={t("Management Fee")}
          type={config.mgmtFeeType}
          value={config.mgmtFeeValue}
          fixedLabel={t("Fixed")}
          pctLabel={t("% of adj. profit")}
          onTypeChange={(v) => onChange("mgmtFeeType", v)}
          onValueChange={set("mgmtFeeValue")}
          amount={mgmtFee}
          basis={Math.max(0, config.snapshotAdjustedProfit)}
        />

      </div>
    </div>
  )
}

// ── Computed owner payouts ────────────────────────────────────

interface OwnerPayoutRow {
  profileId:    string
  fullName:     string | null
  isFeeManager: boolean
  totalPayout:  number
  mgmtFeeShare: number
  branches: {
    branchId:    string
    branchName:  string
    stocks:      number
    totalStocks: number
    percentage:  number
    payout:      number
  }[]
}

function useComputedOwnerPayouts(
  configs:        BranchConfig[],
  feeManagerIds:  Set<string>,
  allAssignments: { profile_id: string; branch_id: string; full_name: string | null }[],
): OwnerPayoutRow[] {
  const { data: allOwnerships = [] } = useAllBranchOwnership()

  return useMemo((): OwnerPayoutRow[] => {
    if (!configs.length) return []

    const ownerMap = new Map<string, OwnerPayoutRow>()

    for (const cfg of configs) {
      const { distributable } = computeAmounts(cfg)

      // Primary: stock-based records from branch_ownership
      const bOwnerships = allOwnerships.filter((o) => o.branch_id === cfg.branchId)

      // Fallback: owners assigned to this branch via the owners table (equal stocks of 1)
      const effectiveOwners = bOwnerships.length > 0
        ? bOwnerships.map((o) => ({
            profile_id: o.profile_id,
            full_name:  (o.profile as { full_name?: string | null } | null)?.full_name ?? null,
            stocks:     o.stocks,
          }))
        : allAssignments
            .filter((a) => a.branch_id === cfg.branchId)
            .map((a) => ({ profile_id: a.profile_id, full_name: a.full_name, stocks: 1 }))

      if (!effectiveOwners.length) continue

      const totalStocks = effectiveOwners.reduce((s, o) => s + o.stocks, 0)
      for (const o of effectiveOwners) {
        const pct    = totalStocks > 0 ? (o.stocks / totalStocks) * 100 : 0
        const payout = totalStocks > 0 ? (o.stocks / totalStocks) * distributable : 0

        const existing = ownerMap.get(o.profile_id) ?? {
          profileId:    o.profile_id,
          fullName:     o.full_name,
          isFeeManager: feeManagerIds.has(o.profile_id),
          totalPayout:  0,
          mgmtFeeShare: 0,
          branches:     [],
        }
        existing.branches.push({ branchId: cfg.branchId, branchName: cfg.branchName, stocks: o.stocks, totalStocks, percentage: pct, payout })
        existing.totalPayout += payout
        ownerMap.set(o.profile_id, existing)
      }
    }

    // Split total mgmt fee equally among fee managers
    const totalMgmtFee = configs.reduce((s, cfg) => s + computeAmounts(cfg).mgmtFee, 0)
    const rows         = Array.from(ownerMap.values())
    const managerCount = rows.filter((r) => r.isFeeManager).length
    const feePerMgr    = managerCount > 0 ? totalMgmtFee / managerCount : 0
    for (const row of rows) {
      if (row.isFeeManager) {
        row.mgmtFeeShare = feePerMgr
        row.totalPayout += feePerMgr
      }
    }

    return rows.sort((a, b) => b.totalPayout - a.totalPayout)
  }, [configs, allOwnerships, feeManagerIds, allAssignments])
}

function getInitials(name: string | null | undefined) {
  if (!name) return "?"
  const p = name.trim().split(/\s+/)
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0].slice(0, 2).toUpperCase()
}

// ── Review step ───────────────────────────────────────────────

function ReviewStep({ configs, ownerPayouts }: { configs: BranchConfig[]; ownerPayouts: OwnerPayoutRow[] }) {
  const fmt = useFormatters()
  const { t } = useLanguage()
  const configsWithAmounts = configs.map((cfg) => ({ ...cfg, ...computeAmounts(cfg) }))

  const totals = configsWithAmounts.reduce(
    (acc, c) => ({
      favor:         acc.favor         + c.favor,
      companyShare:  acc.companyShare  + c.companyShare,
      mgmtFee:       acc.mgmtFee       + c.mgmtFee,
      distributable: acc.distributable + c.distributable,
    }),
    { favor: 0, companyShare: 0, mgmtFee: 0, distributable: 0 },
  )

  const totalOwnerPayout = ownerPayouts.reduce((s, o) => s + o.totalPayout, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* Col 1: Deductions per branch */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Deductions")}</h3>
          <div className="rounded-lg border divide-y">
            {configsWithAmounts.map((cfg) => (
              <div key={cfg.branchId} className="px-3 py-2.5 space-y-1">
                <p className="text-xs font-semibold truncate">{cfg.branchName}</p>
                <div className="text-xs text-muted-foreground mb-0.5">
                  {t("Adj. Profit:")}{" "}
                  <span className={cn(
                    "font-medium",
                    cfg.snapshotAdjustedProfit >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive",
                  )}>{fmt.egp(cfg.snapshotAdjustedProfit)}</span>
                </div>
                <div className="space-y-0.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("Co. Share")}</span>
                    <span className="tabular-nums">{fmt.egp(cfg.companyShare)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("Mgmt Fee")}</span>
                    <span className="tabular-nums">{fmt.egp(cfg.mgmtFee)}</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between font-medium">
                    <span>{t("Distributable")}</span>
                    <span className={cn(
                      "tabular-nums",
                      cfg.distributable >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive",
                    )}>{fmt.egp(cfg.distributable)}</span>
                  </div>
                </div>
              </div>
            ))}
            {/* Totals row */}
            <div className="px-3 py-2.5 bg-muted/40">
              <p className="text-xs font-semibold mb-1">{t("Totals")}</p>
              <div className="space-y-0.5 text-xs">
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">{t("Co. Share")}</span>
                  <span className="tabular-nums text-destructive">{fmt.egp(totals.companyShare)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">{t("Mgmt Fee")}</span>
                  <span className="tabular-nums text-destructive">{fmt.egp(totals.mgmtFee)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Col 2: Owner payouts */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Owner Payouts")}</h3>
          {!ownerPayouts.length ? (
            <p className="text-xs text-muted-foreground italic">{t("No ownership configured.")}</p>
          ) : (
            <div className="rounded-lg border divide-y">
              {ownerPayouts.map((o) => (
                <div key={o.profileId} className="px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                      {getInitials(o.fullName)}
                    </div>
                    <p className="flex-1 min-w-0 text-xs font-medium truncate">{o.fullName ?? t("Unknown")}</p>
                    <p className={cn(
                      "text-xs font-bold tabular-nums shrink-0",
                      o.totalPayout >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive",
                    )}>{fmt.egp(o.totalPayout)}</p>
                  </div>
                  <div className="ps-9 space-y-0.5">
                    {o.branches.map((b) => (
                      <div key={b.branchId} className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="truncate">
                          {b.branchName}
                          <span className="ms-1 text-muted-foreground/60">· {b.stocks}/{b.totalStocks} ({b.percentage.toFixed(1)}%)</span>
                        </span>
                        <span className="tabular-nums ms-2 shrink-0">{fmt.egp(b.payout)}</span>
                      </div>
                    ))}
                    {o.isFeeManager && o.mgmtFeeShare > 0 && (
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{t("Management fee")}</span>
                        <span className="tabular-nums ms-2 shrink-0 text-emerald-600 dark:text-emerald-400">+{fmt.egp(o.mgmtFeeShare)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Col 3: Summary */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Summary")}</h3>
          <div className="rounded-lg border divide-y text-xs">
            <div className="px-3 py-2.5 space-y-1">
              <p className="font-semibold text-muted-foreground">{t("Total Deductions")}</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("Co. Share")}</span>
                <span className="tabular-nums font-medium text-destructive">{fmt.egp(totals.companyShare)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("Mgmt Fee")}</span>
                <span className="tabular-nums font-medium text-destructive">{fmt.egp(totals.mgmtFee)}</span>
              </div>
            </div>
            <div className="px-3 py-2.5 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("Total Distributable")}</span>
                <span className={cn(
                  "tabular-nums font-semibold",
                  totals.distributable >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive",
                )}>{fmt.egp(totals.distributable)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold">{t("Total Owner Payout")}</span>
                <span className={cn(
                  "tabular-nums font-bold",
                  totalOwnerPayout >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive",
                )}>{fmt.egp(totalOwnerPayout)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Main wizard sheet ─────────────────────────────────────────

interface Props {
  open:         boolean
  onOpenChange: (v: boolean) => void
  month:        number
  year:         number
  branches:     Branch[]
  editRun?:     PayoutRunFull
}

function defaultConfig(branch: Branch): BranchConfig {
  return {
    branchId:               branch.id,
    branchName:             branch.name,
    rentType:               "fixed",
    rentValue:              "",
    favorType:              "percentage",
    favorValue:             "",
    companyShareType:       "fixed",
    companyShareValue:      "",
    mgmtFeeType:            "fixed",
    mgmtFeeValue:           "",
    snapshotSales:          0,
    snapshotNetProfit:      0,
    snapshotAdjustments:    0,
    snapshotAdjustedProfit: 0,
  }
}

export function PayoutWizardSheet({ open, onOpenChange, month, year, branches, editRun }: Props) {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const [step, setStep]       = useState<0 | 1>(0)
  const [configs, setConfigs] = useState<BranchConfig[]>([])

  const { data: financials, isLoading: financialsLoading } = useAllBranchFinancials(month, year)
  const { data: rentPaidBranches = new Set<string>() }    = useRentPaidBranches(month, year)
  const { data: savedSettings } = usePayoutSettings()
  const { data: allOwners      = [] } = useGetOwners()
  const { data: allAssignments = [] } = useAllOwnerAssignments()
  const feeManagerIds = useMemo(
    () => new Set(allOwners.filter((o) => o.is_fee_manager).map((o) => o.profile_id)),
    [allOwners],
  )
  const ownerPayouts = useComputedOwnerPayouts(configs, feeManagerIds, allAssignments)
  const create = useCreatePayoutRun()
  const update = useUpdatePayoutRun()

  const hasLastSettings = !!savedSettings?.size

  const monthLabel = format(new Date(year, month - 1, 1), "MMMM yyyy")
  const isEdit     = !!editRun

  // Initialise configs when sheet opens
  useEffect(() => {
    if (!open) return
    setStep(0)

    if (editRun) {
      // In edit mode, snapshot_net_profit stores the adjusted profit
      setConfigs(
        editRun.branches.map((b) => ({
          branchId:               b.branch_id,
          branchName:             b.branch_name,
          rentType:               b.rent_type,
          rentValue:              b.rent_value > 0 ? String(b.rent_value) : "",
          favorType:              b.favor_type,
          favorValue:             b.favor_value > 0 ? String(b.favor_value) : "",
          companyShareType:       b.company_share_type,
          companyShareValue:      b.company_share_value > 0 ? String(b.company_share_value) : "",
          mgmtFeeType:            b.mgmt_fee_type,
          mgmtFeeValue:           b.mgmt_fee_value > 0 ? String(b.mgmt_fee_value) : "",
          snapshotSales:          b.snapshot_sales,
          snapshotNetProfit:      0,
          snapshotAdjustments:    0,
          snapshotAdjustedProfit: b.snapshot_net_profit,
        })),
      )
    } else {
      setConfigs(branches.map(defaultConfig))
    }
  }, [open, editRun, branches])

  // Sync live financials into new-run configs (not when editing).
  // `open` is included so this re-runs after effect 1 resets configs —
  // the query result may already be cached and the other deps unchanged.
  useEffect(() => {
    if (!open || !financials || financialsLoading || isEdit) return
    setConfigs((prev) =>
      prev.map((cfg) => {
        const f = financials.get(cfg.branchId)
        return {
          ...cfg,
          snapshotSales:          f?.sales          ?? cfg.snapshotSales,
          snapshotNetProfit:      f?.netProfit       ?? cfg.snapshotNetProfit,
          snapshotAdjustments:    f?.adjustments     ?? cfg.snapshotAdjustments,
          snapshotAdjustedProfit: f?.adjustedProfit  ?? cfg.snapshotAdjustedProfit,
        }
      }),
    )
  }, [open, financials, financialsLoading, isEdit])

  function applyLastSettings() {
    if (!savedSettings) return
    setConfigs((prev) =>
      prev.map((cfg) => {
        const s = savedSettings.get(cfg.branchId)
        if (!s) return cfg
        return {
          ...cfg,
          favorType:         (s.favor_type ?? "percentage") as DeductionType,
          favorValue:        (s.favor_value ?? 0) > 0 ? String(s.favor_value) : "",
          companyShareType:  s.company_share_type,
          companyShareValue: s.company_share_value > 0 ? String(s.company_share_value) : "",
          mgmtFeeType:       s.mgmt_fee_type,
          mgmtFeeValue:      s.mgmt_fee_value > 0 ? String(s.mgmt_fee_value) : "",
        }
      }),
    )
  }

  function updateConfig(branchId: string, field: keyof BranchConfig, value: string) {
    setConfigs((prev) =>
      prev.map((c) => (c.branchId === branchId ? { ...c, [field]: value } : c)),
    )
  }

  function buildInput(): PayoutRunInput {
    return {
      month,
      year,
      created_by: profile?.id ?? null,
      branches: configs.map((cfg) => {
        const { favor, companyShare, mgmtFee, distributable } = computeAmounts(cfg)
        return {
          branch_id:           cfg.branchId,
          branch_name:         cfg.branchName,
          rent_type:           "fixed"  as const,
          rent_value:          0,
          favor_type:          cfg.favorType,
          favor_value:         num(cfg.favorValue),
          company_share_type:  cfg.companyShareType,
          company_share_value: num(cfg.companyShareValue),
          mgmt_fee_type:       cfg.mgmtFeeType,
          mgmt_fee_value:      num(cfg.mgmtFeeValue),
          snapshot_sales:      cfg.snapshotSales,
          snapshot_net_profit: cfg.snapshotAdjustedProfit,
          rent_amount:          0,
          favor_amount:         favor,
          company_share_amount: companyShare,
          mgmt_fee_amount:      mgmtFee,
          distributable_profit: distributable,
        }
      }),
      owners: ownerPayouts.flatMap((o) =>
        o.branches.map((b) => ({
          branch_id:     b.branchId,
          branch_name:   b.branchName,
          profile_id:    o.profileId,
          full_name:     o.fullName,
          stocks:        b.stocks,
          total_stocks:  b.totalStocks,
          percentage:    b.percentage,
          payout_amount: b.payout,
        })),
      ),
    }
  }

  async function handleSubmit() {
    try {
      const input = buildInput()
      if (isEdit && editRun) {
        await update.mutateAsync({ id: editRun.id, input })
        toast.success(t("Payout run updated"))
      } else {
        await create.mutateAsync(input)
        toast.success(t("Payout run saved"))
      }
      onOpenChange(false)
    } catch {
      toast.error(t("Failed to save payout run"))
    }
  }

  const isPending = create.isPending || update.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">

        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            {isEdit ? t("Edit Payout Run") : t("Run Payout")} — {monthLabel}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2 text-xs">
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
              step === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}>
              1 {t("Configure")}
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground rtl:rotate-180" />
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
              step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}>
              2 {t("Review")}
            </span>
          </SheetDescription>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {step === 0 ? (
            <>
              {financialsLoading && !configs.length ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-72 w-full rounded-xl" />)}
                </div>
              ) : configs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("No branches found.")}</p>
              ) : (
                configs.map((cfg) => (
                  <BranchConfigCard
                    key={cfg.branchId}
                    config={cfg}
                    loading={financialsLoading}
                    rentPaid={rentPaidBranches.has(cfg.branchId)}
                    onChange={(field, value) => updateConfig(cfg.branchId, field, value)}
                  />
                ))
              )}
            </>
          ) : (
            <ReviewStep configs={configs} ownerPayouts={ownerPayouts} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t shrink-0 bg-background">
          {step === 0 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>{t("Cancel")}</Button>
              <div className="flex items-center gap-2">
                {hasLastSettings && (
                  <Button variant="outline" onClick={applyLastSettings}>
                    <History className="h-4 w-4" />
                    {t("Use last settings")}
                  </Button>
                )}
                <Button onClick={() => setStep(1)} disabled={configs.length === 0}>
                  {t("Next: Review")}
                  <ChevronForward className="h-4 w-4 ms-1" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(0)}>
                <ChevronBack className="h-4 w-4 me-1" />
                {t("Back")}
              </Button>
              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                {isEdit ? t("Save Changes") : t("Run Payout")}
              </Button>
            </>
          )}
        </div>

      </SheetContent>
    </Sheet>
  )
}
