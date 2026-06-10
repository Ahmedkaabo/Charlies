import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from "recharts"
import type { TooltipProps } from "recharts"

import { useGetExpenseSummaryByBranch } from "@/hooks/useExpenses"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"

// ── Config (single series, uses chart-2) ──────────────────

const chartConfig: ChartConfig = {
  total: { label: "Total", color: "var(--chart-2)" },
}

// ── Tooltip ────────────────────────────────────────────────

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const { name, total } = payload[0].payload as { name: string; total: number }
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{name}</p>
      <p className="text-muted-foreground">
        EGP {total.toLocaleString("en-US", { minimumFractionDigits: 0 })}
      </p>
    </div>
  )
}

// ── Props ──────────────────────────────────────────────────

interface ExpenseBranchChartProps {
  month: number
  year: number
}

// ── Component ──────────────────────────────────────────────

export function ExpenseBranchChart({ month, year }: ExpenseBranchChartProps) {
  const { data, isLoading } = useGetExpenseSummaryByBranch(month, year)

  if (isLoading) {
    return (
      <div className="space-y-2 h-[220px] flex flex-col justify-center">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  if (!data?.length) {
    return (
      <p className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No expenses this month
      </p>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 24, left: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          interval={0}
          angle={-35}
          textAnchor="end"
          height={50}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
          }
          width={40}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((_, i) => (
            <Cell key={i} fill="var(--chart-2)" />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
