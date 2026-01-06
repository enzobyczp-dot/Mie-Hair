
import { createClient } from '@supabase/supabase-js';

// IMPORTANT: These credentials connect to the sample Supabase project.
// For a production app, replace them with your own project's URL and anon key.
const supabaseUrl: string = 'https://xrnzsmjjbtclmkmrlfxj.supabase.co';
const supabaseAnonKey: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybnpzbWpqYnRjbG1rbXJsZnhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxOTE4OTQsImV4cCI6MjA3Nzc2Nzg5NH0.ZGlPVG9O11UcH9JqmVxgWRWIwL-OMN5d6IVgLCcYqhc';

export const isSupabaseConfigured =
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  supabaseAnonKey !== 'your-anon-key';

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase is not configured. Please add your SUPABASE_URL and SUPABASE_ANON_KEY to lib/supabase.ts to enable authentication."
  );
}

// Initialize the Supabase client.
// Explicitly passing a custom fetch implementation resolves `TypeError: Failed to fetch`
// errors that can occur in sandboxed browser environments (like some iframes).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (input, init) => fetch(input, init),
  },
});
