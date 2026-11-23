import { Radar } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { JobBuilder } from "@/components/collector/job-builder";
import { requireUserOrRedirect } from "@/lib/supabase/server";
import { adapterCatalog } from "@/lib/collector/registry";

export const metadata = { title: "New bulk collection" };

export default async function NewCollectionPage() {
  const { supabase } = await requireUserOrRedirect();
  const [adapters, saved] = await Promise.all([
    adapterCatalog(),
    supabase.from("saved_searches").select("id,name,locations,filters").order("created_at", { ascending: false }).limit(50),
  ]);
  return (
    <>
      <PageHeader icon={<Radar />} title="New bulk collection" description="One job can combine many locations. The job keeps fetching pages until the source reports completion or another stop condition is met." />
      <JobBuilder adapters={adapters} saved={(saved.data ?? []) as never} />
    </>
  );
}
