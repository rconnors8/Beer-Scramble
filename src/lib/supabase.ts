import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Surfaced loudly so a missing .env.local is obvious during setup.
  throw new Error(
    'Missing Supabase config. Copy .env.example to .env.local and set ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // Persist the session and refresh it automatically — this is what keeps
    // players "logged in" across reloads without any PIN.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
