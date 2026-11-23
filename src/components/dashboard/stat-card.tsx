import Link from "next/link";
import { formatNumber } from "@/lib/utils";

export function StatCard({ label, value, hint, icon, href }: { label: string; value: number; hint?: string; icon: React.ReactNode; href?: string }) {
  const body = (
    <div className="group rounded-xl border bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md animate-slide-up">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span className="grid size-8 place-items-center rounded-lg bg-slate-50 text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-600 [&_svg]:size-4">{icon}</span>
      </div>
      <p className="mt-3 text-[28px] font-semibold leading-none tabular-nums tracking-tight text-slate-900">{formatNumber(value)}</p>
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
