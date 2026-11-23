"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { resolveDuplicate, resolveAllSkip } from "@/app/(app)/imports/duplicates/actions";
import { LEAD_FIELDS } from "@/lib/leads/fields";
import { cn } from "@/lib/utils";

type Review = {
  id: string; match_type: string; source_type: string; created_at: string;
  incoming: Record<string, unknown>; matched: Record<string, unknown> | null; matched_lead_id: string | null;
};

const COMPARE = ["full_name", "job_title", "company_name", "business_email", "linkedin_url", "business_phone", "city", "country", "industry"];
const MATCH_LABEL: Record<string, string> = { linkedin_url: "Same LinkedIn URL", email: "Same email", name_company: "Same name + company (uncertain)" };

export function DuplicateReviewList({ reviews }: { reviews: Review[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (id: string, action: "skip" | "update" | "keep_both") => start(async () => {
    const r = await resolveDuplicate(id, action);
    if (!r.ok) toast.error(r.error); else { toast.success("Resolved"); router.refresh(); }
  });
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => { const r = await resolveAllSkip(); if (r.ok) { toast.success("All skipped"); router.refresh(); } else toast.error(r.error); })}>Skip all pending</Button>
      </div>
      {reviews.map((r) => (
        <div key={r.id} className="rounded-xl border bg-white p-4 shadow-xs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge tone={r.match_type === "name_company" ? "amber" : "blue"}>{MATCH_LABEL[r.match_type]}</Badge>
              <span className="text-xs text-slate-500">from {r.source_type}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={pending} onClick={() => act(r.id, "skip")}>Skip incoming</Button>
              <Button size="sm" variant="outline" disabled={pending || !r.matched} onClick={() => act(r.id, "update")}>Update existing</Button>
              <Button size="sm" disabled={pending} onClick={() => act(r.id, "keep_both")}>Keep both</Button>
            </div>
          </div>
          <div className="grid gap-2 text-sm md:grid-cols-[160px_1fr_1fr]">
            <div className="hidden text-xs font-semibold uppercase text-slate-400 md:block">Field</div>
            <div className="text-xs font-semibold uppercase text-slate-400">Incoming record</div>
            <div className="text-xs font-semibold uppercase text-slate-400">Existing lead {r.matched_lead_id ? <Link className="normal-case text-brand-600" href={`/leads/${r.matched_lead_id}`}>open</Link> : null}</div>
            {COMPARE.map((k) => {
              const a = r.incoming[k] as string | null | undefined;
              const b = r.matched?.[k] as string | null | undefined;
              const differs = (a ?? "") !== (b ?? "") && a && b;
              return (
                <div key={k} className="contents">
                  <div className="text-xs text-slate-500 md:py-1">{LEAD_FIELDS.find((f) => f.key === k)?.label}</div>
                  <div className={cn("truncate rounded px-2 py-1", differs && "bg-amber-50")}>{a || <span className="text-slate-300">—</span>}</div>
                  <div className={cn("truncate rounded px-2 py-1", differs && "bg-amber-50")}>{b || <span className="text-slate-300">—</span>}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
