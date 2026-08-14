// Tambahkan opsi `fetch` custom saat createClient supaya request GET ke
// PostgREST (select) tidak pernah di-cache oleh browser.
//
// SEBELUM (kemungkinan isi lib/supabase.ts kamu sekarang):
//
//   import { createClient } from '@supabase/supabase-js'
//   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
//   const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
//   export const supabase = createClient(supabaseUrl, supabaseAnonKey)
//
// SESUDAH — tambahkan `global.fetch` dengan cache: 'no-store':

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (input, init) =>
      fetch(input, {
        ...init,
        cache: 'no-store', // jangan pernah pakai response GET dari cache browser
      }),
  },
})