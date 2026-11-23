import { SquareKanban } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Kanban } from "@/components/pipeline/kanban";
import { requireUserOrRedirect } from "@/lib/supabase/server";
import { LEAD_STATUSES } from "@/lib/constants";

export const metadata = { title: "Pipeline" };
const PER_COLUMN = 50;

export default async function PipelinePage() {
  const { supabase } = await requireUserOrRedirect();
  const cols = "id,full_name,job_title,company_name,city,country,priority,status";
  const [counts, ...columns] = await Promise.all([
    supabase.rpc("pipeline_counts"),
    ...LEAD_STATUSES.map((s) => supabase.from("leads").select(cols).eq("status", s.value).order("updated_at", { ascending: false }).limit(PER_COLUMN)),
  ]);
  const c = Object.fromEntries(((counts.data ?? []) as { status: string; value: number }[]).map((r) => [r.status, Number(r.value)]));
  return (
    <>
      <PageHeader icon={<SquareKanban />} title="Pipeline" description={`Drag cards between stages to update status. Each column shows the ${PER_COLUMN} most recently updated leads.`} />
      <Kanban initial={columns.flatMap((r) => (r.data ?? []) as never[])} counts={c} perColumn={PER_COLUMN} />
    </>
  );
}
