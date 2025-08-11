import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const supabaseUrl2 = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey2 = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabaseReal = createClient(supabaseUrl2, supabaseAnonKey2)