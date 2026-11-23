// Public Supabase values (the project URL and anon key are public by design; Row Level Security protects data).
// Used when the NEXT_PUBLIC_ variables are missing or empty at build time, e.g. when they were saved in a way
// that does not reach the build. Set the env vars to point the app at a different Supabase project.
const DEFAULT_SUPABASE_URL = "https://cqfrgjrzgdbnjfhskgit.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZnJnanJ6Z2RibmpmaHNrZ2l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0MjIwOTUsImV4cCI6MjExMDk5ODA5NX0.dGAeO2-OgulYmfH4pfCKVDi2ppfWf4ZDtfZLsRW1HiY";

export function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
}
export function supabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || DEFAULT_SUPABASE_ANON_KEY;
}

export function publicEnv() {
  const url = supabaseUrl();
  const anonKey = supabaseAnonKey();
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return { url, anonKey };
}

export const isSupabaseConfigured = () => !!supabaseUrl() && !!supabaseAnonKey();

/** Server-only: the single administrator allowed to use the app. */
export function adminEmail(): string | null {
  const v = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return v ? v : null;
}

export function isAllowedUser(email: string | null | undefined) {
  const admin = adminEmail();
  if (!admin) return true; // not locked; README tells the user to set ADMIN_EMAIL
  return (email ?? "").trim().toLowerCase() === admin;
}
