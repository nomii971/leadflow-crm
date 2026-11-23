import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { publicEnv, isAllowedUser } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = publicEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: middleware refreshes the session instead.
        }
      },
    },
  });
}

export class AuthError extends Error {
  status = 401;
}

/** Returns the signed-in administrator or throws. Use in route handlers and server actions. */
export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new AuthError("Not signed in");
  if (!isAllowedUser(data.user.email)) throw new AuthError("This account is not the LeadFlow administrator");
  return { supabase, user: data.user };
}

/** Same as requireUser but redirects to /login. Use in pages and layouts. */
export async function requireUserOrRedirect() {
  try {
    return await requireUser();
  } catch {
    redirect("/login");
  }
}
