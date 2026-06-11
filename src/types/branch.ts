export interface BranchShift {
  id: string
  branch_id: string
  name: string
  shift_start: string             // TIME "HH:MM:SS"
  shift_end: string               // TIME "HH:MM:SS"
  checkin_window_minutes: number
  full_day_hours: number
  overtime_hours: number
  late_grace_minutes: number
  late_deduction_enabled: boolean
  late_per_minutes: number | null
  late_deduct_hours: number | null
  is_active: boolean
  created_at: string
}

export interface Branch {
  id: string
  name: string
  name_ar: string | null
  address: string | null
  city: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  owner_id: string | null
  latitude: number | null
  longitude: number | null
  location_radius_meters: number
  shift_start: string           // TIME "HH:MM:SS"
  shift_end: string             // TIME "HH:MM:SS"
  checkin_window_minutes: number
  min_shift_hours: number
  max_shift_hours: number
}

export interface BranchMember {
  id: string
  branch_id: string
  profile_id: string
  role_id: string | null
  joined_at: string
  is_active: boolean
  // Joined via Supabase select — may be null if profiles RLS restricts the row
  profile: {
    id: string
    full_name: string | null
    avatar_url: string | null
    phone: string | null
  } | null
  role: {
    id: string
    name: string
    name_ar?: string | null
    level: number
  } | null
}
