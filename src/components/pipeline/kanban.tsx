"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { GripVertical } from "lucide-react";
import { LEAD_STATUSES } from "@/lib/constants";
import { PriorityBadge } from "@/components/shared/status-badges";
import { cn, formatNumber } from "@/lib/utils";
import { setLeadStatus } from "@/app/(app)/leads/actions";

type Card = { id: string; full_name: string; job_title: string | null; company_name: string | null; city: string | null; country: string | null; priority: string; status: string };

const DOT: Record<string, string> = {
  slate: "bg-slate-400", violet: "bg-violet-500", blue: "bg-blue-500", cyan: "bg-cyan-500", amber: "bg-amber-500", orange: "bg-orange-500", emerald: "bg-emerald-500", rose: "bg-rose-500",
};

export function Kanban({ initial, counts, perColumn }: { initial: Card[]; counts: Record<string, number>; perColumn: number }) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [cnt, setCnt] = useState(counts);
  const [over, setOver] = useState<string | null>(null);
  const [, start] = useTransition();

  const move = (id: string, to: string) => {
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === to) return;
    const from = card.status;
    setCards(cards.map((c) => (c.id === id ? { ...c, status: to } : c)));
    setCnt({ ...cnt, [from]: (cnt[from] ?? 1) - 1, [to]: (cnt[to] ?? 0) + 1 });
    start(async () => {
      const r = await setLeadStatus(id, to);
      if (!r.ok) {
        toast.error(r.error);
        setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: from } : c)));
        setCnt((c) => ({ ...c, [from]: (c[from] ?? 0) + 1, [to]: (c[to] ?? 1) - 1 }));
      } else router.refresh();
    });
  };

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 scrollbar-thin">
      <div className="flex min-w-max gap-3">
        {LEAD_STATUSES.map((s) => {
          const col = cards.filter((c) => c.status === s.value);
          return (
            <div key={s.value}
              onDragOver={(e) => { e.preventDefault(); setOver(s.value); }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => { e.preventDefault(); setOver(null); move(e.dataTransfer.getData("text/plain"), s.value); }}
              className={cn("flex w-72 flex-col rounded-xl border bg-slate-100/70 transition", over === s.value && "border-brand-400 bg-brand-50")}>
              <div className="flex items-center justify-between px-3 py-2.5">
                <p className="flex items-center gap-2 text-sm font-semibold"><span className={cn("size-2 rounded-full", DOT[s.color])} />{s.label}</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600 shadow-xs">{formatNumber(cnt[s.value] ?? 0)}</span>
              </div>
              <div className="flex max-h-[calc(100vh-240px)] min-h-32 flex-col gap-2 overflow-y-auto px-2 pb-2 scrollbar-thin">
                {col.map((c) => (
                  <div key={c.id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; }}
                    className="group cursor-grab rounded-lg border bg-white p-3 shadow-xs transition hover:shadow-md active:cursor-grabbing">
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="mt-0.5 size-3.5 shrink-0 text-slate-300 group-hover:text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/leads/${c.id}`} className="block truncate text-sm font-medium hover:text-brand-600">{c.full_name}</Link>
                        <p className="truncate text-xs text-slate-500">{[c.job_title, c.company_name].filter(Boolean).join(" · ") || "—"}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] text-slate-400">{[c.city, c.country].filter(Boolean).join(", ")}</span>
                          <PriorityBadge priority={c.priority} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {(cnt[s.value] ?? 0) > col.length && col.length >= perColumn ? (
                  <Link href={`/leads?status=${s.value}`} className="py-1 text-center text-xs font-medium text-brand-600 hover:underline">
                    +{formatNumber((cnt[s.value] ?? 0) - col.length)} more in All Leads
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
