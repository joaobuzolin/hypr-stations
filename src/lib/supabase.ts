import { createClient } from '@supabase/supabase-js';

// Cell Map Supabase project (will be configured when project is created)
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = SUPABASE_URL
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
