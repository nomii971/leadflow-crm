"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/utils";

const schema = z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(500).optional().nullable(), color: z.string().max(20).optional() });

export async function createList(input: z.input<typeof schema>) {
  try {
    const { supabase } = await requireUser();
    const v = schema.parse(input);
    const { data, error } = await supabase.from("lead_lists").insert(v).select("id").single();
    if (error) return { ok: false as const, error: error.code === "23505" ? "A list with this name already exists" : error.message };
    revalidatePath("/lists");
    return { ok: true as const, id: data.id as string };
  } catch (e) { return { ok: false as const, error: errorMessage(e) }; }
}

export async function updateList(id: string, input: z.input<typeof schema>) {
  try {
    const { supabase } = await requireUser();
    const v = schema.parse(input);
    const { error } = await supabase.from("lead_lists").update(v).eq("id", z.string().uuid().parse(id));
    if (error) return { ok: false as const, error: error.code === "23505" ? "A list with this name already exists" : error.message };
    revalidatePath("/lists");
    return { ok: true as const };
  } catch (e) { return { ok: false as const, error: errorMessage(e) }; }
}

export async function deleteList(id: string) {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("lead_lists").delete().eq("id", z.string().uuid().parse(id));
    if (error) return { ok: false as const, error: error.message };
    revalidatePath("/lists");
    return { ok: true as const };
  } catch (e) { return { ok: false as const, error: errorMessage(e) }; }
}
