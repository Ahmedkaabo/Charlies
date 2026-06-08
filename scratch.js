const { createClient } = require('@supabase/supabase-js')

// Just mock the client, we don't need real keys to test getPublicUrl
const supabaseUrl = 'https://lnyomtunwwfqbcqoqdwu.supabase.co'
const supabaseKey = 'fake-key-doesnt-matter'
const supabase = createClient(supabaseUrl, supabaseKey)

const url = supabase.storage.from("attendance-selfies").getPublicUrl("1ad25832-fa1c-4c5b-8342-f5bf8cc2cd1c/2026-06-08-checkin.png")
console.log(url.data.publicUrl)
