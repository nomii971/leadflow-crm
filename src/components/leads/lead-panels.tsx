"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock, Mail, MessageSquare, Pencil, Phone, Send, StickyNote, Trash, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/misc";
import { PriorityBadge } from "@/components/shared/status-badges";
import { LeadForm } from "./lead-form";
import { ACTIVITY_TYPES, LEAD_STATUSES, PRIORITIES } from "@/lib/constants";
import type { Activity, Lead, Task } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { addLeadsToList, addNote, createTask, deleteNote, deleteTask, logActivity, setLeadStatus, setTaskCompleted } from "@/app/(app)/leads/actions";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  call: Phone, email: Mail, linkedin_message: Send, meeting: Users, note: StickyNote, status_change: Pencil, other: MessageSquare,
};

export function StatusSwitcher({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <Select className="h-9 w-48" defaultValue={lead.status} disabled={pending}
        onChange={(e) => start(async () => {
          const r = await setLeadStatus(lead.id, e.target.value);
          if (!r.ok) toast.error(r.error); else { toast.success("Status updated"); router.refresh(); }
        })}>
        {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </Select>
      {pending ? <Spinner /> : null}
    </div>
  );
}

export function EditLeadButton({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}><Pencil /> Edit</Button>
      <DialogContent title="Edit lead" className="max-w-4xl"><LeadForm lead={lead} onDone={() => setOpen(false)} /></DialogContent>
    </Dialog>
  );
}

export function AddToListButton({ leadId, lists }: { leadId: string; lists: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!lists.length) return null;
  return (
    <Select className="h-9 w-44" value="" disabled={pending}
      onChange={(e) => e.target.value && start(async () => {
        const r = await addLeadsToList({ ids: [leadId] }, e.target.value);
        if (!r.ok) toast.error(r.error); else { toast.success("Added to list"); router.refresh(); }
      })}>
      <option value="">Add to list…</option>
      {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
    </Select>
  );
}

type TimelineItem = { kind: "activity"; a: Activity } | { kind: "note"; n: { id: string; content: string; created_at: string } };

export function ActivityPanel({ leadId, activities, notes }: { leadId: string; activities: Activity[]; notes: { id: string; content: string; created_at: string }[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"activity" | "note">("activity");
  const [pending, start] = useTransition();
  const items: TimelineItem[] = [
    ...activities.map((a) => ({ kind: "activity" as const, a })),
    ...notes.map((n) => ({ kind: "note" as const, n })),
  ].sort((x, y) => new Date(y.kind === "activity" ? y.a.occurred_at : y.n.created_at).getTime() - new Date(x.kind === "activity" ? x.a.occurred_at : x.n.created_at).getTime());

  const submit = (fd: FormData) => start(async () => {
    const r = mode === "note"
      ? await addNote(leadId, String(fd.get("body") ?? ""))
      : await logActivity({ lead_id: leadId, type: String(fd.get("type")), subject: String(fd.get("subject") ?? ""), body: String(fd.get("body") ?? ""), outcome: String(fd.get("outcome") ?? ""), occurred_at: String(fd.get("occurred_at") ?? "") || null });
    if (!r.ok) toast.error(r.error); else { toast.success(mode === "note" ? "Note added" : "Activity logged"); router.refresh(); }
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Activity & notes</CardTitle>
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
          {(["activity", "note"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn("rounded-md px-3 py-1 font-medium", mode === m ? "bg-white shadow-xs" : "text-slate-500")}>
              {m === "activity" ? "Log activity" : "Add note"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <form action={submit} className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3" key={mode}>
          {mode === "activity" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Type">
                <Select name="type" defaultValue="call">{ACTIVITY_TYPES.filter((t) => !["status_change", "note"].includes(t.value)).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select>
              </Field>
              <Field label="Subject"><Input name="subject" placeholder="Intro call" /></Field>
              <Field label="When"><Input name="occurred_at" type="datetime-local" /></Field>
              <Field label="Outcome" className="sm:col-span-3"><Input name="outcome" placeholder="e.g. Interested, call back next week" /></Field>
            </div>
          ) : null}
          <Textarea name="body" placeholder={mode === "note" ? "Write a personal note…" : "Details (optional)"} rows={2} required={mode === "note"} />
          <div className="flex justify-end"><Button size="sm" disabled={pending}>{pending ? <Spinner /> : null}Save</Button></div>
        </form>
        <ol className="mt-4 space-y-3">
          {items.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No activity yet</p> : null}
          {items.map((it) => {
            if (it.kind === "note") {
              return (
                <li key={`n-${it.n.id}`} className="flex gap-3">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600"><StickyNote className="size-3.5" /></span>
                  <div className="min-w-0 flex-1 rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Note · {formatDate(it.n.created_at, true)}</span>
                      <button aria-label="Delete note" onClick={() => start(async () => { await deleteNote(it.n.id); router.refresh(); })} className="text-slate-400 hover:text-rose-600"><Trash className="size-3.5" /></button>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{it.n.content}</p>
                  </div>
                </li>
              );
            }
            const Icon = ICONS[it.a.type] ?? MessageSquare;
            return (
              <li key={`a-${it.a.id}`} className="flex gap-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600"><Icon className="size-3.5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm"><b className="font-medium">{ACTIVITY_TYPES.find((t) => t.value === it.a.type)?.label}</b>{it.a.subject ? ` · ${it.a.subject}` : ""}</p>
                  <p className="text-xs text-slate-500">{formatDate(it.a.occurred_at, true)}{it.a.outcome ? ` · ${it.a.outcome}` : ""}</p>
                  {it.a.body ? <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{it.a.body}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

export function TasksPanel({ leadId, tasks }: { leadId: string | null; tasks: Task[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const submit = (fd: FormData) => start(async () => {
    const r = await createTask({
      lead_id: leadId, title: String(fd.get("title")), type: String(fd.get("type")) as "follow_up",
      due_at: String(fd.get("due_at") ?? "") || null, priority: String(fd.get("priority")) as "medium",
    });
    if (!r.ok) toast.error(r.error); else { toast.success("Follow-up created"); router.refresh(); }
  });
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-slate-400" /> Follow-ups</CardTitle></CardHeader>
      <CardContent>
        <form action={submit} className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
          <Input name="title" placeholder="Follow up about proposal" required />
          <div className="grid grid-cols-3 gap-2">
            <Input name="due_at" type="datetime-local" className="col-span-3 sm:col-span-1" />
            <Select name="type" defaultValue="follow_up">
              <option value="follow_up">Follow-up</option><option value="call">Call</option><option value="email">Email</option>
              <option value="linkedin_message">LinkedIn msg</option><option value="meeting">Meeting</option>
            </Select>
            <Select name="priority" defaultValue="medium">{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select>
          </div>
          <div className="flex justify-end"><Button size="sm" disabled={pending}>Add follow-up</Button></div>
        </form>
        <ul className="mt-3 space-y-2">
          {tasks.length === 0 ? <p className="py-4 text-center text-sm text-slate-400">No follow-ups</p> : null}
          {tasks.map((t) => {
            const overdue = !t.completed && t.due_at && new Date(t.due_at) < new Date();
            return (
              <li key={t.id} className="flex items-start gap-2 rounded-lg border border-slate-100 px-3 py-2">
                <Checkbox className="mt-0.5" checked={t.completed} onChange={(e) => start(async () => { await setTaskCompleted(t.id, e.target.checked); router.refresh(); })} aria-label="Complete" />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", t.completed && "text-slate-400 line-through")}>{t.title}</p>
                  <p className={cn("text-xs", overdue ? "font-medium text-rose-600" : "text-slate-500")}>{t.due_at ? `${overdue ? "Overdue · " : "Due "}${formatDate(t.due_at, true)}` : "No due date"}</p>
                </div>
                <PriorityBadge priority={t.priority} />
                <button aria-label="Delete task" onClick={() => start(async () => { await deleteTask(t.id); router.refresh(); })} className="text-slate-300 hover:text-rose-600"><Trash className="size-3.5" /></button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
