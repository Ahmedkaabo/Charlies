export interface Permission {
  id: string
  role_id: string
  resource: Resource
  can_create: boolean
  can_read: boolean
  can_update: boolean
  can_delete: boolean
  created_at: string
}

export type RoleType = "managerial" | "operational"

export interface Role {
  id: string
  name: string
  level: number
  is_system?: boolean
  role_type?: RoleType
}

export type Resource =
  | "branches"
  | "staff"
  | "checkin"
  | "attendance"
  | "expenses"
  | "sales"
  | "finance"
  | "balance"
  | "branch_breakdown"
  | "treasury"
  | "pool_transfers"
  | "settings"
  | "permissions"
  | "payroll"
  | "owners"

export type CrudField = "can_create" | "can_read" | "can_update" | "can_delete"

export const RESOURCES: { key: Resource; label: string }[] = [
  { key: "branches",       label: "Branches"        },
  { key: "staff",          label: "Staff"           },
  { key: "checkin",        label: "Check-in"        },
  { key: "attendance",     label: "Attendance"      },
  { key: "expenses",       label: "Expenses"        },
  { key: "sales",          label: "Sales"           },
  { key: "finance",        label: "Finance"         },
  { key: "balance",           label: "Balance"           },
  { key: "branch_breakdown",  label: "Branch Breakdown"  },
  { key: "treasury",          label: "Main Treasury"     },
  { key: "pool_transfers", label: "Pool Transfers"  },
  { key: "settings",       label: "Settings"        },
  { key: "permissions",    label: "Permissions"     },
  { key: "payroll",        label: "Payroll"         },
  { key: "owners",         label: "Owners"          },
]

export const CRUD_FIELDS: { key: CrudField; label: string }[] = [
  { key: "can_create", label: "C" },
  { key: "can_read",   label: "R" },
  { key: "can_update", label: "U" },
  { key: "can_delete", label: "D" },
]
