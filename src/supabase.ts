import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
console.log('ENV CHECK:', {
  url: import.meta.env.VITE_SUPABASE_URL,
  keyFound: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
});
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase configuration is missing. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
