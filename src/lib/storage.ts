import { supabase } from "@/lib/supabase"

export async function uploadReceipt(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg"
  const timestamp = new Date().getTime()
  const random = Math.random().toString(36).slice(2, 9)
  const path = `${timestamp}_${random}.${ext}`

  const { error } = await supabase.storage
    .from("receipts")
    .upload(path, file, { upsert: false, contentType: file.type })

  if (error) throw error

  const { data } = supabase.storage.from("receipts").getPublicUrl(path)
  return data.publicUrl
}

export async function uploadSalesReceipt(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg"
  const timestamp = new Date().getTime()
  const random = Math.random().toString(36).slice(2, 9)
  const path = `sales/${timestamp}_${random}.${ext}`

  const { error } = await supabase.storage
    .from("receipts")
    .upload(path, file, { upsert: false, contentType: file.type })

  if (error) throw error

  const { data } = supabase.storage.from("receipts").getPublicUrl(path)
  return data.publicUrl
}

export async function uploadAvatar(file: File, profileId: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg"
  const path = `${profileId}/avatar.${ext}`

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw error

  const { data } = supabase.storage.from("avatars").getPublicUrl(path)
  return data.publicUrl
}
