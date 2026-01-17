import { createClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const db = createClient<Database>(supabaseUrl, supabaseKey);