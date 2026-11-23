export function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return { url, anonKey };
}

export const isSupabaseConfigured = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Server-only: the single administrator allowed to use the app. */
export function adminEmail(): string | null {
  const v = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return v ? v : null;
}

export function isAllowedUser(email: string | null | undefined) {
  const admin = adminEmail();
  if (!admin) return true; // not locked; README tells the user to set ADMIN_EMAIL
  return (email ?? "").toLowerCase() === admin;
}
