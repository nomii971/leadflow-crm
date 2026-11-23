"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Callout, Spinner } from "@/components/ui/misc";
import { COMPANY_SIZES, DEPARTMENTS, INDUSTRIES, LEAD_STATUSES, PRIORITIES, SENIORITY_LEVELS } from "@/lib/constants";
import { COUNTRIES } from "@/lib/locations";
import type { Lead } from "@/lib/types";
import { createLead, updateLead } from "@/app/(app)/leads/actions";

export function LeadForm({ lead, onDone }: { lead?: Lead; onDone?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dup, setDup] = useState<{ id: string; type: string } | null>(null);
  const v = (k: keyof Lead) => ((lead?.[k] as string | null) ?? "") as string;

  const submit = (fd: FormData) =>
    start(async () => {
      if (lead) {
        const r = await updateLead(lead.id, fd);
        if (!r.ok) return void toast.error(r.error);
        toast.success("Lead saved");
        onDone?.();
        router.refresh();
        return;
      }
      if (dup) fd.set("force", "true");
      const r = await createLead(fd);
      if (!r.ok) {
        if (r.error.startsWith("DUPLICATE:")) {
          const [, id, type] = r.error.split(":");
          setDup({ id, type });
          return;
        }
        return void toast.error(r.error);
      }
      toast.success("Lead created");
      router.push(`/leads/${r.data!.id}`);
    });

  return (
    <form action={submit} className="space-y-6">
      {dup ? (
        <Callout tone="warning" title="Possible duplicate found">
          A lead with the same {dup.type.replace("_", " + ").replace("linkedin url", "LinkedIn URL")} already exists.{" "}
          <Link className="font-semibold underline" href={`/leads/${dup.id}`}>Open existing lead</Link>, or press <b>Save anyway</b> to keep both records.
        </Callout>
      ) : null}
      <section className="grid gap-4 sm:grid-cols-3">
        <Field label="Full name"><Input name="full_name" defaultValue={v("full_name")} placeholder="Derived from first + last if empty" /></Field>
        <Field label="First name"><Input name="first_name" defaultValue={v("first_name")} /></Field>
        <Field label="Last name"><Input name="last_name" defaultValue={v("last_name")} /></Field>
        <Field label="Job title"><Input name="job_title" defaultValue={v("job_title")} /></Field>
        <Field label="Company name"><Input name="company_name" defaultValue={v("company_name")} /></Field>
        <Field label="Industry">
          <Input name="industry" list="industries" defaultValue={v("industry")} />
          <datalist id="industries">{INDUSTRIES.map((i) => <option key={i} value={i} />)}</datalist>
        </Field>
        <Field label="Seniority">
          <Input name="seniority" list="seniorities" defaultValue={v("seniority")} />
          <datalist id="seniorities">{SENIORITY_LEVELS.map((i) => <option key={i} value={i} />)}</datalist>
        </Field>
        <Field label="Department">
          <Input name="department" list="departments" defaultValue={v("department")} />
          <datalist id="departments">{DEPARTMENTS.map((i) => <option key={i} value={i} />)}</datalist>
        </Field>
        <Field label="Company size">
          <Select name="company_size" defaultValue={v("company_size")}>
            <option value="">—</option>
            {COMPANY_SIZES.map((s) => <option key={s}>{s}</option>)}
            {lead?.company_size && !COMPANY_SIZES.includes(lead.company_size) ? <option>{lead.company_size}</option> : null}
          </Select>
        </Field>
      </section>
      <section className="grid gap-4 sm:grid-cols-4">
        <Field label="Country">
          <Input name="country" list="countries" defaultValue={v("country")} />
          <datalist id="countries">{COUNTRIES.map((c) => <option key={c.code} value={c.name} />)}</datalist>
        </Field>
        <Field label="State / Province"><Input name="state" defaultValue={v("state")} /></Field>
        <Field label="City"><Input name="city" defaultValue={v("city")} /></Field>
        <Field label="Region"><Input name="region" defaultValue={v("region")} /></Field>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="LinkedIn profile URL"><Input name="linkedin_url" defaultValue={v("linkedin_url")} placeholder="https://www.linkedin.com/in/…" /></Field>
        <Field label="Company website"><Input name="company_website" defaultValue={v("company_website")} /></Field>
        <div className="flex items-end gap-3">
          <Field label="Business email" className="flex-1"><Input name="business_email" type="email" defaultValue={v("business_email")} /></Field>
          <label className="mb-2 flex items-center gap-1.5 text-xs text-slate-600"><Checkbox name="email_verified" defaultChecked={lead?.email_verified} /> Verified</label>
        </div>
        <div className="flex items-end gap-3">
          <Field label="Business phone" className="flex-1"><Input name="business_phone" defaultValue={v("business_phone")} /></Field>
          <label className="mb-2 flex items-center gap-1.5 text-xs text-slate-600"><Checkbox name="phone_verified" defaultChecked={lead?.phone_verified} /> Verified</label>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-4">
        <Field label="Status">
          <Select name="status" defaultValue={lead?.status ?? "new"}>{LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>
        </Field>
        <Field label="Priority">
          <Select name="priority" defaultValue={lead?.priority ?? "medium"}>{PRIORITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>
        </Field>
        <Field label="Lead source"><Input name="lead_source" defaultValue={v("lead_source")} placeholder="e.g. LinkedIn Sales Navigator" /></Field>
        <Field label="Source reference / URL"><Input name="source_reference" defaultValue={v("source_reference")} /></Field>
      </section>
      <Field label="Notes"><Textarea name="notes" defaultValue={v("notes")} rows={3} /></Field>
      <label className="flex items-center gap-2 text-sm"><Checkbox name="is_verified" defaultChecked={lead?.is_verified} /> I have verified this record</label>
      <div className="flex justify-end gap-2">
        {onDone ? <Button type="button" variant="outline" onClick={onDone}>Cancel</Button> : null}
        <Button type="submit" disabled={pending}>{pending ? <Spinner /> : null}{dup ? "Save anyway" : lead ? "Save changes" : "Create lead"}</Button>
      </div>
    </form>
  );
}
