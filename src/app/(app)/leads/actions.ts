"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { STATUS_VALUES, PRIORITY_VALUES, ACTIVITY_TYPES } from "@/lib/constants";
import { validateLeadFields } from "@/lib/leads/validate";
import { bulkTargetSchema, forEachIdChunk, resolveLeadIds, type BulkTarget } from "@/lib/leads/query";
import { keysFor, findMatch, type ExistingLeadKey } from "@/lib/leads/dedupe";
import { errorMessage } from "@/lib/utils";

type Result<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

const LEAD_FORM_FIELDS = [
  "full_name", "first_name", "last_name", "job_title", "company_name", "industry", "country", "state", "city", "region",
  "linkedin_url", "company_website", "business_email", "business_phone", "company_size", "seniority", "department",
  "lead_source", "source_reference", "status", "priority", "notes", "last_contacted_at",
];

function formToLead(fd: FormData) {
  const obj: Record<string, unknown> = {};
  for (const k of LEAD_FORM_FIELDS) {
    const v = fd.get(k);
    if (typeof v === "string") obj[k] = v;
  }
  for (const b of ["email_verified", "phone_verified", "is_verified"]) obj[b] = fd.get(b) === "on" || fd.get(b) === "true";
  return validateLeadFields(obj);
}

export async function createLead(fd: FormData): Promise<Result<{ id: string; duplicateOf?: string }>> {
  try {
    const { supabase } = await requireUser();
    const v = formToLead(fd);
    if (!v.ok) return { ok: false, error: v.errors.join("; ") };
    const force = fd.get("force") === "true";
    if (!force) {
      const k = keysFor(v.lead);
      const { data } = await supabase.rpc("find_duplicate_candidates", {
        p_linkedin: k.linkedin ? [k.linkedin] : [],
        p_emails: k.email ? [k.email] : [],
        p_name_company: k.nameCompany ? [k.nameCompany] : [],
      });
      const m = findMatch(k, (data ?? []) as ExistingLeadKey[]);
      if (m) return { ok: false, error: `DUPLICATE:${m.lead.id}:${m.type}` };
    }
    const { data, error } = await supabase.from("leads").insert({ ...v.lead, origin: "manual" }).select("id").single();
    if (error) return { ok: false, error: error.message };
    revalidatePath("/leads");
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function updateLead(id: string, fd: FormData): Promise<Result> {
  try {
    const { supabase } = await requireUser();
    z.string().uuid().parse(id);
    const v = formToLead(fd);
    if (!v.ok) return { ok: false, error: v.errors.join("; ") };
    const { data: before } = await supabase.from("leads").select("status").eq("id", id).single();
    const { error } = await supabase.from("leads").update(v.lead).eq("id", id);
    if (error) return { ok: false, error: error.message };
    if (before && before.status !== v.lead.status) {
      await supabase.from("activities").insert({ lead_id: id, type: "status_change", subject: `Status: ${before.status} → ${v.lead.status}` });
    }
    revalidatePath(`/leads/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function setLeadStatus(id: string, status: string): Promise<Result> {
  try {
    const { supabase } = await requireUser();
    z.string().uuid().parse(id);
    const s = z.enum(STATUS_VALUES).parse(status);
    const { data: before } = await supabase.from("leads").select("status").eq("id", id).single();
    const { error } = await supabase.from("leads").update({ status: s }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    if (before && before.status !== s) {
      await supabase.from("activities").insert({ lead_id: id, type: "status_change", subject: `Status: ${before.status} → ${s}` });
    }
    revalidatePath("/pipeline");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function bulkUpdateLeads(target: BulkTarget, patch: { status?: string; priority?: string; is_verified?: boolean }): Promise<Result<{ count: number }>> {
  try {
    const { supabase } = await requireUser();
    const t = bulkTargetSchema.parse(target);
    const p = z.object({ status: z.enum(STATUS_VALUES).optional(), priority: z.enum(PRIORITY_VALUES).optional(), is_verified: z.boolean().optional() }).parse(patch);
    if (Object.keys(p).length === 0) return { ok: false, error: "Nothing to update" };
    const ids = await resolveLeadIds(supabase, t);
    await forEachIdChunk(ids, 200, async (part) => {
      const { error } = await supabase.from("leads").update(p).in("id", part);
      if (error) throw new Error(error.message);
    });
    revalidatePath("/leads");
    return { ok: true, data: { count: ids.length } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function bulkDeleteLeads(target: BulkTarget): Promise<Result<{ count: number }>> {
  try {
    const { supabase } = await requireUser();
    const t = bulkTargetSchema.parse(target);
    const ids = await resolveLeadIds(supabase, t);
    await forEachIdChunk(ids, 200, async (part) => {
      const { error } = await supabase.from("leads").delete().in("id", part);
      if (error) throw new Error(error.message);
    });
    revalidatePath("/leads");
    return { ok: true, data: { count: ids.length } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function addLeadsToList(target: BulkTarget, listId: string): Promise<Result<{ count: number }>> {
  try {
    const { supabase } = await requireUser();
    const t = bulkTargetSchema.parse(target);
    z.string().uuid().parse(listId);
    const ids = await resolveLeadIds(supabase, t);
    await forEachIdChunk(ids, 500, async (part) => {
      const { error } = await supabase
        .from("lead_list_members")
        .upsert(part.map((lead_id) => ({ list_id: listId, lead_id })), { onConflict: "list_id,lead_id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    });
    revalidatePath("/lists");
    return { ok: true, data: { count: ids.length } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function removeLeadsFromList(listId: string, ids: string[]): Promise<Result> {
  try {
    const { supabase } = await requireUser();
    z.string().uuid().parse(listId);
    z.array(z.string().uuid()).max(1000).parse(ids);
    const { error } = await supabase.from("lead_list_members").delete().eq("list_id", listId).in("lead_id", ids);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/lists/${listId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

// ---- Notes, activities, tasks on a lead ----

export async function addNote(leadId: string | null, content: string): Promise<Result> {
  try {
    const { supabase } = await requireUser();
    const c = z.string().trim().min(1).max(20000).parse(content);
    const { error } = await supabase.from("notes").insert({ lead_id: leadId, content: c });
    if (error) return { ok: false, error: error.message };
    if (leadId) revalidatePath(`/leads/${leadId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteNote(id: string): Promise<Result> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("notes").delete().eq("id", z.string().uuid().parse(id));
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

const activitySchema = z.object({
  lead_id: z.string().uuid().nullable(),
  type: z.enum(ACTIVITY_TYPES.map((a) => a.value) as [string, ...string[]]),
  subject: z.string().trim().max(300).optional().nullable(),
  body: z.string().trim().max(20000).optional().nullable(),
  outcome: z.string().trim().max(200).optional().nullable(),
  occurred_at: z.string().max(40).optional().nullable(),
});

export async function logActivity(input: z.input<typeof activitySchema>): Promise<Result> {
  try {
    const { supabase } = await requireUser();
    const a = activitySchema.parse(input);
    const occurred = a.occurred_at ? new Date(a.occurred_at) : new Date();
    if (Number.isNaN(occurred.getTime())) return { ok: false, error: "Invalid date" };
    const { error } = await supabase.from("activities").insert({ ...a, occurred_at: occurred.toISOString() });
    if (error) return { ok: false, error: error.message };
    if (a.lead_id) revalidatePath(`/leads/${a.lead_id}`);
    revalidatePath("/activities");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

const taskSchema = z.object({
  lead_id: z.string().uuid().nullable(),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(5000).optional().nullable(),
  type: z.enum(["follow_up", "call", "email", "linkedin_message", "meeting", "other"]).default("follow_up"),
  due_at: z.string().max(40).optional().nullable(),
  priority: z.enum(PRIORITY_VALUES).default("medium"),
});

export async function createTask(input: z.input<typeof taskSchema>): Promise<Result> {
  try {
    const { supabase } = await requireUser();
    const t = taskSchema.parse(input);
    const due = t.due_at ? new Date(t.due_at) : null;
    if (due && Number.isNaN(due.getTime())) return { ok: false, error: "Invalid due date" };
    const { error } = await supabase.from("tasks").insert({ ...t, due_at: due?.toISOString() ?? null });
    if (error) return { ok: false, error: error.message };
    if (t.lead_id) revalidatePath(`/leads/${t.lead_id}`);
    revalidatePath("/follow-ups");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function setTaskCompleted(id: string, completed: boolean): Promise<Result> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("tasks")
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq("id", z.string().uuid().parse(id));
    if (error) return { ok: false, error: error.message };
    revalidatePath("/follow-ups");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteTask(id: string): Promise<Result> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("tasks").delete().eq("id", z.string().uuid().parse(id));
    if (error) return { ok: false, error: error.message };
    revalidatePath("/follow-ups");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
