import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env vars. Make sure VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_PUBLISHABLE_KEY are set in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
  },
  global: {
    // Retry failed fetches up to 3 times with exponential back-off
    fetch: async (url, options = {}) => {
      const MAX_RETRIES = 3;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const response = await fetch(url, options);
          return response;
        } catch (err) {
          lastError = err as Error;
          // Exponential back-off: 300ms, 600ms, 1200ms
          if (attempt < MAX_RETRIES - 1) {
            await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt)));
          }
        }
      }
      throw lastError;
    },
  },
});
