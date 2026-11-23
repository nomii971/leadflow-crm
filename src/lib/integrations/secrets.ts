import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Provider = "hubspot";

/**
 * Token for a provider, read on the server only. A hosting env var wins (HUBSPOT_ACCESS_TOKEN), otherwise the
 * token saved from the Integrations page (encrypted in Supabase Vault, readable only by the signed-in owner).
 */
export async function getProviderToken(provider: Provider): Promise<{ token: string; source: "env" | "app" } | null> {
  const env = provider === "hubspot" ? process.env.HUBSPOT_ACCESS_TOKEN?.trim() : undefined;
  if (env) return { token: env, source: "env" };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_integration_secret", { p_provider: provider });
    if (error || typeof data !== "string" || !data) return null;
    return { token: data, source: "app" };
  } catch {
    return null; // no request context or not signed in
  }
}
