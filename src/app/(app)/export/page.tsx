import { Download } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { ExportCenter } from "@/components/export/export-center";
import { requireUserOrRedirect } from "@/lib/supabase/server";

export const metadata = { title: "Export Center" };

export default async function ExportPage() {
  const { supabase } = await requireUserOrRedirect();
  const dims = ["country", "city", "industry", "job_title"] as const;
  const [lists, jobs, ...tops] = await Promise.all([
    supabase.from("lead_lists").select("id,name").order("name"),
    supabase.from("collection_jobs").select("id,name").order("created_at", { ascending: false }).limit(100),
    ...dims.map((d) => supabase.rpc("distinct_lead_values", { p_dimension: d, p_limit: 100 })),
  ]);
  const top = Object.fromEntries(dims.map((d, i) => [d, ((tops[i].data ?? []) as { label: string; value: number }[]).map((r) => ({ label: r.label, value: Number(r.value) }))])) as never;
  return (
    <>
      <PageHeader icon={<Download />} title="Export Center" description="Export all, filtered, or grouped leads, lists and collection job results to Excel or CSV with the columns you choose." />
      <ExportCenter lists={lists.data ?? []} jobs={jobs.data ?? []} top={top} />
    </>
  );
}
