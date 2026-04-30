import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/lib/types/database.types.js'
import 'dotenv/config'

const url = process.env.PUBLIC_SUPABASE_URL
const key = process.env.PRIVATE_SUPABASE_KEY

if (!url || !key) {
  throw new Error('PUBLIC_SUPABASE_URL and PRIVATE_SUPABASE_KEY must be set')
}

export const supabase = createClient<Database>(url, key)
