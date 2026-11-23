import { Search } from "lucide-react";

/** Global search + quick actions, shown above every page on desktop. */
export function Topbar() {
  return (
    <header className="sticky top-0 z-20 hidden h-14 items-center gap-4 border-b border-slate-200/80 bg-white/80 px-8 backdrop-blur-md lg:flex">
      <form action="/leads" className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          name="q"
          placeholder="Search leads by name, company, title, email or city…"
          className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </form>
      <p className="ml-auto text-xs text-slate-400">Press Enter to search all leads</p>
    </header>
  );
}
