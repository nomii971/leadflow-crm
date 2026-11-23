import { cn } from "@/lib/utils";
import { LoaderCircle } from "lucide-react";

export const Skeleton = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded-md bg-slate-100", className)} />;

export const Spinner = ({ className }: { className?: string }) => <LoaderCircle className={cn("size-4 animate-spin", className)} />;

export function PageHeader({ title, description, actions, icon }: { title: string; description?: string; actions?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        {icon ? <div className="mt-0.5 grid size-11 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-violet-50 text-brand-600 ring-1 ring-brand-100 [&_svg]:size-5">{icon}</div> : null}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      {icon ? <div className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500 [&_svg]:size-6">{icon}</div> : null}
      <div>
        <p className="font-medium text-slate-900">{title}</p>
        {description ? <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Callout({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "success" | "danger"; title?: string; children: React.ReactNode; className?: string }) {
  const tones = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    danger: "border-rose-200 bg-rose-50 text-rose-900",
  };
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone], className)}>
      {title ? <p className="mb-0.5 font-semibold">{title}</p> : null}
      <div className="leading-relaxed opacity-90">{children}</div>
    </div>
  );
}
