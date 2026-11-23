"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { IMPORT_STRATEGIES } from "@/lib/constants";
import { changePassword, deleteAllLeads, saveSettings } from "@/app/(app)/settings/actions";

type S = { display_name: string | null; default_page_size: number; default_import_strategy: string; default_lead_source: string | null; timezone: string | null };

export function SettingsForm({ s }: { s: S }) {
  const [pending, start] = useTransition();
  return (
    <form className="grid gap-4 sm:grid-cols-2" action={(fd) => start(async () => { const r = await saveSettings(fd); if (r.ok) toast.success("Settings saved"); else toast.error(r.error); })}>
      <Field label="Display name"><Input name="display_name" defaultValue={s.display_name ?? ""} /></Field>
      <Field label="Time zone"><Input name="timezone" defaultValue={s.timezone ?? "UTC"} placeholder="e.g. Asia/Karachi" /></Field>
      <Field label="Default import strategy">
        <Select name="default_import_strategy" defaultValue={s.default_import_strategy}>{IMPORT_STRATEGIES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</Select>
      </Field>
      <Field label="Default lead source"><Input name="default_lead_source" defaultValue={s.default_lead_source ?? ""} /></Field>
      <div className="flex items-end justify-end sm:col-span-2"><Button disabled={pending}>Save settings</Button></div>
    </form>
  );
}

export function PasswordForm() {
  const [pw, setPw] = useState("");
  const [pending, start] = useTransition();
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await changePassword(pw); if (r.ok) { toast.success("Password changed"); setPw(""); } else toast.error(r.error); }); }}>
      <Field label="New password" className="min-w-60 flex-1"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={10} /></Field>
      <Button disabled={pending || pw.length < 10} variant="outline">Change password</Button>
    </form>
  );
}

export function DangerZone() {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label='Type "DELETE ALL LEADS" to permanently remove every lead, note, activity and task' className="min-w-72 flex-1"><Input value={text} onChange={(e) => setText(e.target.value)} /></Field>
      <Button variant="destructive" disabled={pending || text !== "DELETE ALL LEADS"} onClick={() => start(async () => { const r = await deleteAllLeads(text); if (r.ok) { toast.success("All leads deleted"); setText(""); } else toast.error(r.error); })}>Delete all leads</Button>
    </div>
  );
}
