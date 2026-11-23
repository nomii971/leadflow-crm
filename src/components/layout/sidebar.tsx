"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity, Building, CalendarClock, ClockArrowLeft, Download, LayoutDashboard, ListChecks, LogOut, Menu, Plug,
  Radar, Settings, SquareKanban, Users, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: typeof Radar; highlight?: boolean };
const NAV: { section: string; items: Item[] }[] = [
  { section: "Overview", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/collector", label: "Bulk Lead Collector", icon: Radar, highlight: true },
  ] },
  { section: "Leads", items: [
    { href: "/leads", label: "All Leads", icon: Users },
    { href: "/lists", label: "Lead Lists", icon: ListChecks },
    { href: "/companies", label: "Companies", icon: Building },
    { href: "/pipeline", label: "Pipeline", icon: SquareKanban },
  ] },
  { section: "Outreach", items: [
    { href: "/activities", label: "Activities", icon: Activity },
    { href: "/follow-ups", label: "Follow-ups", icon: CalendarClock },
  ] },
  { section: "Data", items: [
    { href: "/imports", label: "Import History", icon: ClockArrowLeft },
    { href: "/export", label: "Export Center", icon: Download },
    { href: "/integrations", label: "Integrations", icon: Plug },
    { href: "/settings", label: "Settings", icon: Settings },
  ] },
];

export function Sidebar({ email, overdue }: { email: string; overdue: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 scrollbar-thin">
      {NAV.map((group) => (
      <div key={group.section} className="flex flex-col gap-0.5">
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{group.section}</p>
      {group.items.map((item) => {
        const active = path === item.href || path.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              active ? "bg-white/[0.08] text-white before:absolute before:-left-3 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r before:bg-indigo-400" : "text-slate-400 hover:bg-white/[0.04] hover:text-white",
              item.highlight && !active && "text-indigo-200",
            )}
          >
            <span
              className={cn(
                "grid size-7 place-items-center rounded-md transition-colors",
                item.highlight ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-900/40" : active ? "text-white" : "text-slate-500 group-hover:text-slate-300",
              )}
            >
              <Icon className="size-4" />
            </span>
            <span className="flex-1">{item.label}</span>
            {item.href === "/follow-ups" && overdue > 0 ? (
              <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">{overdue}</span>
            ) : null}
            {item.highlight ? <span className="rounded bg-indigo-500/20 px-1.5 text-[10px] font-semibold uppercase text-indigo-200">Bulk</span> : null}
          </Link>
        );
      })}
      </div>
      ))}
    </nav>
  );

  const body = (
    <div className="flex h-full flex-col bg-sidebar py-5">
      <Link href="/dashboard" className="mb-6 flex items-center gap-2.5 px-6">
        <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">LF</span>
        <span className="text-[15px] font-semibold tracking-tight text-white">LeadFlow CRM</span>
      </Link>
      {nav}
      <div className="mx-3 mt-4 flex items-center gap-3 rounded-xl border border-white/5 bg-sidebar-muted p-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-semibold text-white">{(email[0] ?? "?").toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-slate-200" title={email}>{email}</p>
          <p className="text-[11px] text-slate-500">Administrator</p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" title="Sign out" aria-label="Sign out">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{body}</aside>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-sidebar px-4 py-3 lg:hidden">
        <span className="font-semibold text-white">LeadFlow CRM</span>
        <button onClick={() => setOpen(true)} className="text-slate-200" aria-label="Open menu"><Menu className="size-5" /></button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72">
            {body}
            <button onClick={() => setOpen(false)} className="absolute right-3 top-5 text-slate-300" aria-label="Close menu"><X className="size-5" /></button>
          </div>
        </div>
      ) : null}
    </>
  );
}
