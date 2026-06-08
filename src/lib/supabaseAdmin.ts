import { createClient } from "@supabase/supabase-js"

const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string | undefined

// Only available when VITE_SUPABASE_SERVICE_ROLE_KEY is set in .env.
// Used for admin-level auth operations (update user email / password).
// NOTE: keep this key private — do not commit it to source control.
export const supabaseAdmin = serviceKey
  ? createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  : null
