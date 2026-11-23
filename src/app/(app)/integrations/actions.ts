"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/utils";

type Result = { ok: true; message: string } | { ok: false; error: string };

const tokenSchema = z.string().trim().min(10, "Paste the full token").max(500).regex(/^\S+$/, "The token must not contain spaces");

/** Checks the token with HubSpot, then stores it encrypted (Supabase Vault). The token is never sent back to the browser. */
export async function saveHubspotToken(raw: string): Promise<Result> {
  try {
    const { supabase } = await requireUser();
    const token = tokenSchema.parse(raw);
    let res: Response;
    try {
      res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
      });
    } catch {
      return { ok: false, error: "Could not reach HubSpot. Try again in a minute." };
    }
    if (res.status === 401) return { ok: false, error: "HubSpot did not accept this token. Copy it again from your private app." };
    if (res.status === 403) return { ok: false, error: "The token works but is missing the contacts read scope (crm.objects.contacts.read). Add it in the private app and try again." };
    if (!res.ok && res.status !== 429) return { ok: false, error: `HubSpot answered with an error (${res.status}). Try again.` };
    const { error } = await supabase.rpc("set_integration_secret", { p_provider: "hubspot", p_secret: token });
    if (error) throw new Error(error.message);
    revalidatePath("/integrations");
    revalidatePath("/collector/new");
    return { ok: true, message: "HubSpot connected." };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid token" };
    return { ok: false, error: errorMessage(e) };
  }
}

export async function removeHubspotToken(): Promise<Result> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("clear_integration_secret", { p_provider: "hubspot" });
    if (error) throw new Error(error.message);
    revalidatePath("/integrations");
    return { ok: true, message: "HubSpot token removed." };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
