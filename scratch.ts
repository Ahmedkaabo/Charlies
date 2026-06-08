import { supabase } from "@/lib/supabase"

async function test() {
  const profileId = "1ad25832-fa1c-4c5b-8342-f5bf8cc2cd1c"
  const path = `${profileId}/2026-06-08-checkin.png`

  console.log("Removing", path)
  const rm = await supabase.storage.from("attendance-selfies").remove([path])
  console.log("Remove result:", rm)
}

test()
