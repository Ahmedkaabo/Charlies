export type SalaryCurrency = "EGP" | "USD"

// ── Multi-branch grouped types ────────────────────────────────

export interface MemberAssignment {
  /** staff.id */
  id: string
  branch_id: string
  branch_name: string
  role_ids: string[]
  role_id: string | null
  role: { id: string; name: string; name_ar?: string | null; level: number } | null
  joined_at: string
  salary: { monthly_salary: number | null; currency: SalaryCurrency; paid_days_off: number } | null
}

/** One entry per person, with all their branch assignments collapsed in. */
export interface GroupedMember {
  profile_id: string
  full_name: string | null
  name_ar: string | null
  avatar_url: string | null
  phone: string | null
  email: string | null
  is_admin: boolean
  last_login_at: string | null
  assignments: MemberAssignment[]
}

export interface Member {
  id: string
  branch_id: string
  profile_id: string
  role_id: string | null
  joined_at: string
  is_active: boolean
  // May be null when RLS restricts profile visibility
  profile: {
    id: string
    full_name: string | null
    name_ar: string | null
    avatar_url: string | null
    phone: string | null
    email: string | null
    is_admin: boolean
    last_login_at: string | null
  } | null
  role: {
    id: string
    name: string
    name_ar?: string | null
    level: number
  } | null
  branch: {
    id: string
    name: string
    name_ar?: string | null
  } | null
  salary: {
    id: string
    monthly_salary: number | null
    currency: SalaryCurrency
    effective_from: string
    paid_days_off: number
  } | null
}

// Salary is only required for operational roles (level ≥ 3).
// Admins (is_admin), Admins role (level 0) and area_manager (level 2) are excluded.
export function salaryRequired(member: Pick<Member, "profile" | "role">): boolean {
  if (member.profile?.is_admin) return false
  if ((member.role?.level ?? 99) <= 2) return false
  return true
}
