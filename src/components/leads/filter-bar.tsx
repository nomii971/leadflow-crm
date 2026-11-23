"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { LEAD_STATUSES, ORIGINS, PRIORITIES } from "@/lib/constants";

const KEYS = ["q", "status", "priority", "country", "city", "industry", "job_title", "company", "origin", "verified", "has_email", "list_id"];

export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const set = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (resetPage) next.delete("page");
    start(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  return { sp, set, pending };
}

export function LeadFilterBar({ hide = [] }: { hide?: string[] }) {
  const { sp, set, pending } = useUrlParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [text, setText] = useState({ country: sp.get("country") ?? "", city: sp.get("city") ?? "", industry: sp.get("industry") ?? "", job_title: sp.get("job_title") ?? "" });

  useEffect(() => {
    const t = setTimeout(() => {
      if ((sp.get("q") ?? "") !== q) set({ q });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = KEYS.filter((k) => !hide.includes(k) && sp.get(k)).length;
  const commit = (k: keyof typeof text) => {
    if ((sp.get(k) ?? "") !== text[k]) set({ [k]: text[k] });
  };

  return (
    <div className="mb-4 rounded-xl border bg-white p-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full flex-1 sm:min-w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, title, company, email, city…" className="pl-9" />
        </div>
        <Select value={sp.get("status") ?? ""} onChange={(e) => set({ status: e.target.value })} className="w-[calc(50%-4px)] sm:w-40">
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
        <Select value={sp.get("priority") ?? ""} onChange={(e) => set({ priority: e.target.value })} className="w-[calc(50%-4px)] sm:w-36">
          <option value="">Any priority</option>
          {PRIORITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
        {pending ? <Spinner className="text-slate-400" /> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {(["country", "city", "industry", "job_title"] as const).filter((k) => !hide.includes(k)).map((k) => (
          <Input
            key={k}
            value={text[k]}
            onChange={(e) => setText({ ...text, [k]: e.target.value })}
            onBlur={() => commit(k)}
            onKeyDown={(e) => e.key === "Enter" && commit(k)}
            placeholder={k === "job_title" ? "Job title" : k.charAt(0).toUpperCase() + k.slice(1)}
            className="h-8 w-[calc(50%-4px)] text-xs sm:w-40"
          />
        ))}
        <Select value={sp.get("origin") ?? ""} onChange={(e) => set({ origin: e.target.value })} className="h-8 w-[calc(50%-4px)] text-xs sm:w-40">
          <option value="">Any origin</option>
          {ORIGINS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
        <Select value={sp.get("verified") ?? ""} onChange={(e) => set({ verified: e.target.value })} className="h-8 w-[calc(50%-4px)] text-xs sm:w-36">
          <option value="">Verified or not</option>
          <option value="yes">Verified</option>
          <option value="no">Unverified</option>
        </Select>
        <Select value={sp.get("has_email") ?? ""} onChange={(e) => set({ has_email: e.target.value })} className="h-8 w-[calc(50%-4px)] text-xs sm:w-32">
          <option value="">Email: any</option>
          <option value="yes">Has email</option>
          <option value="no">No email</option>
        </Select>
        {active > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setText({ country: "", city: "", industry: "", job_title: "" });
              set(Object.fromEntries(KEYS.filter((k) => !hide.includes(k)).map((k) => [k, null])));
            }}
          >
            <X /> Clear {active} filter{active > 1 ? "s" : ""}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
