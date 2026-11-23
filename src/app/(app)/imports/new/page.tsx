import { FileUp } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { ImportWizard } from "@/components/import/import-wizard";
import { requireUserOrRedirect } from "@/lib/supabase/server";
import type { ImportStrategy } from "@/lib/constants";

export const metadata = { title: "Bulk CSV import" };

export default async function NewImportPage() {
  const { supabase } = await requireUserOrRedirect();
  const { data: s } = await supabase.from("user_settings").select("default_import_strategy,default_lead_source").maybeSingle();
  return (
    <>
      <PageHeader icon={<FileUp />} title="Bulk CSV / Excel import" description="Upload, map, validate, de-duplicate and import thousands of leads in batches with live progress." />
      <ImportWizard defaultStrategy={(s?.default_import_strategy as ImportStrategy) ?? "skip_duplicates"} defaultSource={s?.default_lead_source ?? "LinkedIn Sales Navigator"} />
    </>
  );
}
