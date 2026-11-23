import Link from "next/link";
import { FileUp, Plus, Users } from "lucide-react";
import { PageHeader, Callout } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { LeadFilterBar } from "@/components/leads/filter-bar";
import { LeadsTable } from "@/components/leads/leads-table";
import { requireUserOrRedirect } from "@/lib/supabase/server";
import { fetchLeadPage } from "@/lib/leads/fetch-page";

export const metadata = { title: "All Leads" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { supabase } = await requireUserOrRedirect();
  const [res, lists] = await Promise.all([
    fetchLeadPage(supabase, sp),
    supabase.from("lead_lists").select("id,name").order("name"),
  ]);
  return (
    <>
      <PageHeader
        icon={<Users />}
        title="All Leads"
        description="Search, filter, sort and act on your whole lead database. Pagination happens on the server."
        actions={
          <>
            <Button variant="outline" asChild><Link href="/imports/new"><FileUp /> Import</Link></Button>
            <Button asChild><Link href="/leads/new"><Plus /> Add lead</Link></Button>
          </>
        }
      />
      {res.error ? <Callout tone="danger" title="Could not load leads" className="mb-4">{res.error}</Callout> : null}
      <LeadFilterBar />
      <LeadsTable {...res} lists={lists.data ?? []} />
    </>
  );
}
