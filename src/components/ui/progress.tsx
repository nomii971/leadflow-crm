import { cn } from "@/lib/utils";

export function Progress({ value, className, tone = "brand", indeterminate }: { value: number | null; className?: string; tone?: "brand" | "emerald" | "amber" | "rose"; indeterminate?: boolean }) {
  const colors = { brand: "bg-brand-600", emerald: "bg-emerald-500", amber: "bg-amber-500", rose: "bg-rose-500" };
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)} role="progressbar" aria-valuenow={value ?? undefined} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", colors[tone], indeterminate && "w-1/3 animate-pulse")}
        style={indeterminate ? undefined : { width: `${v}%` }}
      />
    </div>
  );
}
