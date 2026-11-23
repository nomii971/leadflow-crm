import Link from "next/link";
import { Building, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireUserOrRedirect } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "Companies" };

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; sort?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireUserOrRedirect();
  const page = Math.max(1, Number(sp.page) || 1);
  const per = 50;
  const sort = sp.sort === "name" ? "name" : "lead_count";
  let q = supabase.from("companies_with_counts").select("*", { count: "exact" }).order(sort, { ascending: sort === "name" }).range((page - 1) * per, page * per - 1);
  if (sp.q) q = q.ilike("name", `%${sp.q.replace(/[%_\\*]/g, "")}%`);
  const { data, count } = await q;
  const rows = (data ?? []) as { id: string; name: string; website: string | null; email: string | null; phone: string | null; industry: string | null; company_size: string | null; country: string | null; city: string | null; lead_count: number }[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / per));
  const link = (p: Record<string, string>) => `?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.sort ? { sort: sp.sort } : {}), ...p })}`;
  return (
    <>
      <PageHeader icon={<Building />} title="Companies" description="Companies are created automatically from your leads' company names (matched ignoring case and suffixes like Ltd / Inc)." />
      <form className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input name="q" defaultValue={sp.q} placeholder="Search companies" className="pl-9" />
      </form>
      <div className="rounded-xl border bg-white shadow-xs">
        <Table>
          <THead><TR><TH><Link href={link({ sort: "name" })}>Company</Link></TH><TH>Industry</TH><TH>Size</TH><TH>Location</TH><TH>Website</TH><TH>Email / phone</TH><TH className="text-right"><Link href={link({ sort: "leads" })}>Leads</Link></TH></TR></THead>
          <TBody>
            {rows.length === 0 ? <TR><TD colSpan={7} className="py-12 text-center text-slate-400">No companies yet</TD></TR> : null}
            {rows.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium"><Link className="hover:text-brand-600 hover:underline" href={`/leads?company_id=${c.id}`}>{c.name}</Link></TD>
                <TD>{c.industry ?? "—"}</TD>
                <TD>{c.company_size ?? "—"}</TD>
                <TD>{[c.city, c.country].filter(Boolean).join(", ") || "—"}</TD>
                <TD className="max-w-48 truncate">{c.website ? <a className="text-brand-600 hover:underline" href={c.website} target="_blank" rel="noopener noreferrer">{c.website.replace(/^https?:\/\//, "")}</a> : "—"}</TD>
                <TD className="max-w-56 text-xs">{c.email || c.phone ? <div className="space-y-0.5">{c.email ? <a className="block truncate text-brand-600 hover:underline" href={`mailto:${c.email}`}>{c.email}</a> : null}{c.phone ? <span className="block truncate text-slate-600">{c.phone}</span> : null}</div> : "—"}</TD>
                <TD className="text-right tabular-nums">{formatNumber(Number(c.lead_count))}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <div className="flex items-center justify-between border-t px-3 py-2 text-sm text-slate-600">
          <span>{formatNumber(count ?? 0)} companies</span>
          <span className="flex gap-3">
            {page > 1 ? <Link className="text-brand-600" href={link({ page: String(page - 1) })}>Previous</Link> : null}
            Page {page} of {pages}
            {page < pages ? <Link className="text-brand-600" href={link({ page: String(page + 1) })}>Next</Link> : null}
          </span>
        </div>
      </div>
    </>
  );
}
