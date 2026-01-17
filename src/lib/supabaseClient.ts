import { createClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_KEY
} from '$env/static/public';

export const db = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_KEY);