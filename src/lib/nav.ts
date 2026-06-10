import {
  Users,
  UserCheck,
  CalendarCheck,
  Receipt,
  Banknote,
  TrendingUp,
  DollarSign,
  Landmark,
  type LucideIcon,
} from "lucide-react"
import type { Resource } from "@/types/permission"

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  resource?: Resource
  adminOnly?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

const HR_ITEMS: NavItem[] = [
  { label: "Staff",      path: "/staff",      icon: Users,         resource: "staff"      },
  { label: "Check-in",   path: "/checkin",    icon: UserCheck,     resource: "checkin"    },
  { label: "Attendance", path: "/attendance", icon: CalendarCheck, resource: "attendance" },
  { label: "Payroll",    path: "/payroll",    icon: Banknote,      resource: "payroll"    },
]

const ACCOUNTING_ITEMS: NavItem[] = [
  { label: "Sales",    path: "/sales",    icon: TrendingUp, resource: "sales"    },
  { label: "Expenses", path: "/expenses", icon: Receipt,    resource: "expenses" },
  { label: "Balance",  path: "/balance",  icon: Landmark,   resource: "balance"  },
  { label: "Payout",   path: "/finance",  icon: DollarSign, resource: "finance"  },
]

export const NAV_GROUPS: NavGroup[] = [
  { label: "Accounting", items: ACCOUNTING_ITEMS },
  { label: "HR",         items: HR_ITEMS         },
]

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)

export const ROUTE_TITLES: Record<string, string> = {
  "/":            "Dashboard",
  "/users":       "Owners",
  "/branches":    "Branches",
  "/staff":       "Staff",
  "/checkin":     "Check-in",
  "/attendance":  "Attendance",
  "/payroll":     "Payroll",
  "/expenses":    "Expenses",
  "/sales":       "Sales",
  "/finance":     "Payout",
  "/balance":     "Balance",
  "/settings":    "Settings",
  "/categories":  "Expense Categories",
  "/permissions": "Roles & Permissions",
  "/admin":       "Admin Panel",
}
