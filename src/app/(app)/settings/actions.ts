"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/utils";

const schema = z.object({
  display_name: z.string().trim().max(120).optional().nullable(),
  default_page_size: z.coerce.number().int().min(10).max(200).optional(),
  default_import_strategy: z.enum(["new_only", "update_existing", "skip_duplicates", "review_duplicates"]),
  default_lead_source: z.string().trim().max(200).optional().nullable(),
  timezone: z.string().trim().max(60).optional().nullable(),
});

export async function saveSettings(fd: FormData) {
  try {
    const { supabase, user } = await requireUser();
    const v = schema.parse(Object.fromEntries(fd));
    const { error } = await supabase.from("user_settings").upsert({ user_id: user.id, ...v });
    if (error) return { ok: false as const, error: error.message };
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (e) { return { ok: false as const, error: errorMessage(e) }; }
}

export async function changePassword(password: string) {
  try {
    const { supabase } = await requireUser();
    const p = z.string().min(10, "Use at least 10 characters").max(200).parse(password);
    const { error } = await supabase.auth.updateUser({ password: p });
    return error ? { ok: false as const, error: error.message } : { ok: true as const };
  } catch (e) { return { ok: false as const, error: errorMessage(e) }; }
}

export async function deleteAllLeads(confirm: string) {
  try {
    const { supabase, user } = await requireUser();
    if (confirm !== "DELETE ALL LEADS") return { ok: false as const, error: "Type the confirmation text exactly." };
    const { error } = await supabase.from("leads").delete().eq("user_id", user.id);
    if (error) return { ok: false as const, error: error.message };
    await supabase.from("companies").delete().eq("user_id", user.id);
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (e) { return { ok: false as const, error: errorMessage(e) }; }
}
