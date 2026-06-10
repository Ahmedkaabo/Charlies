export interface OwnerBranch {
  assignment_id: string  // owners.id
  branch_id:     string
  branch_name:   string
  city:          string | null
  joined_at:     string
  role_ids:      string[]
  role_id:       string | null
  role_name:     string | null
  role_level:    number | null
}

export interface Owner {
  profile_id:     string
  full_name:      string | null
  name_ar:        string | null
  avatar_url:     string | null
  phone:          string | null
  is_fee_manager: boolean
  is_master:      boolean
  role_ids:       string[]
  branches:       OwnerBranch[]
}
