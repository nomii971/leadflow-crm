import { useId } from "react";
import { cn } from "@/lib/utils";

/** LeadFlow mark: three leads flowing into one forward arrow. */
export function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8 shrink-0", className)} role="img" aria-label="LeadFlow">
      <defs>
        <linearGradient id={`lf-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#lf-${id})`} />
      <g transform="translate(3 0)" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 19c13 0 13 13 26 13M15 45c13 0 13-13 26-13M15 32h26" opacity=".95" />
        <path d="M38 24l9 8-9 8" />
      </g>
      <g transform="translate(3 0)" fill="#fff"><circle cx="13" cy="19" r="4" /><circle cx="13" cy="32" r="4" /><circle cx="13" cy="45" r="4" /></g>
    </svg>
  );
}

/** Mark + wordmark. `tone="dark"` is for dark backgrounds (sidebar), `light` for white ones. */
export function Logo({ tone = "light", className, markClassName, showCrm = true }: { tone?: "light" | "dark"; className?: string; markClassName?: string; showCrm?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className={cn("text-[17px] font-bold leading-none tracking-tight", tone === "dark" ? "text-white" : "text-slate-900")}>
        Lead<span className={tone === "dark" ? "text-indigo-300" : "text-brand-600"}>Flow</span>
        {showCrm ? <span className={cn("ml-1.5 rounded px-1 py-0.5 align-middle text-[10px] font-semibold tracking-wider", tone === "dark" ? "bg-white/10 text-indigo-200" : "bg-brand-50 text-brand-700")}>CRM</span> : null}
      </span>
    </span>
  );
}
