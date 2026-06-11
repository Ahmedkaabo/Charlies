import { useMemo } from "react"
import { PieChart, Pie } from "recharts"

import { useGetExpenseSummaryByCategory } from "@/hooks/useExpenses"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { useFormatters, useLocalName } from "@/lib/format"

// ── Helpers ────────────────────────────────────────────────

function toKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "_")
}

// These reference global :root vars — available anywhere in the DOM
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

// ── Props ──────────────────────────────────────────────────

interface ExpenseSummaryChartProps {
  month: number
  year: number
  branchId?: string
}

// ── Component ──────────────────────────────────────────────

export function ExpenseSummaryChart({ month, year, branchId }: ExpenseSummaryChartProps) {
  const { data, isLoading } = useGetExpenseSummaryByCategory(month, year, branchId)
  const fmt = useFormatters()
  const ln  = useLocalName()

  const pieData = useMemo(
    () =>
      (data ?? []).map((item) => ({
        ...item,
        key:  toKey(item.name),
        fill: `var(--color-${toKey(item.name)})`,
      })),
    [data],
  )

  const chartConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = { total: { label: "Amount" } }
    ;(data ?? []).forEach((item, i) => {
      cfg[toKey(item.name)] = {
        label: ln(item.name, item.name_ar),
        color: CHART_COLORS[i % CHART_COLORS.length],
      }
    })
    return cfg
  }, [data])

  // ── Loading ────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center gap-6 h-[200px]">
        <div className="flex-1 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
        <Skeleton className="h-36 w-36 rounded-full shrink-0" />
      </div>
    )
  }

  if (!pieData.length) {
    return (
      <p className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No expenses this month
      </p>
    )
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="grid grid-cols-2 items-center gap-4">
      {/* Left col: category list with amounts */}
      <div className="flex flex-col justify-center gap-2.5 min-w-0">
        {pieData.map((item, i) => (
          <div key={item.key} className="flex items-center gap-2 text-xs min-w-0">
            <div
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="text-muted-foreground truncate">{ln(item.name, item.name_ar)}</span>
            <span className="ms-auto font-semibold tabular-nums shrink-0">
              {fmt.egp(item.total)}
            </span>
          </div>
        ))}
      </div>

      {/* Right col: donut pie */}
      <ChartContainer config={chartConfig} className="h-[200px] aspect-auto">
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                nameKey="key"
                labelKey="key"
                formatter={(value) => fmt.egp(Number(value))}
              />
            }
          />
          <Pie
            data={pieData}
            dataKey="total"
            nameKey="key"
            innerRadius={58}
            outerRadius={88}
            paddingAngle={2}
            strokeWidth={2}
          />
        </PieChart>
      </ChartContainer>
    </div>
  )
}
