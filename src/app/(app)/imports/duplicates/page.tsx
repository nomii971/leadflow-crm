import { GitMerge } from "lucide-react";
import { EmptyState, PageHeader, Callout } from "@/components/ui/misc";
import { DuplicateReviewList } from "@/components/import/duplicate-review";
import { requireUserOrRedirect } from "@/lib/supabase/server";

export const metadata = { title: "Duplicate review" };

export default async function DuplicatesPage() {
  const { supabase } = await requireUserOrRedirect();
  const { data, count } = await supabase
    .from("duplicate_reviews")
    .select("id,match_type,source_type,created_at,incoming,matched_lead_id, matched:leads!duplicate_reviews_matched_lead_id_fkey(*)", { count: "exact" })
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);
  return (
    <>
      <PageHeader icon={<GitMerge />} title="Duplicate review" description={`${count ?? 0} possible duplicates waiting for your decision. Nothing is merged until you choose.`} />
      <Callout tone="info" className="mb-4">“Update existing” copies non-empty incoming values onto the existing lead (status, priority and notes are kept). “Keep both” saves the incoming record as a separate lead.</Callout>
      {(data ?? []).length === 0 ? (
        <EmptyState icon={<GitMerge />} title="No duplicates to review" description="Possible duplicates from imports and collection jobs appear here." />
      ) : (
        <DuplicateReviewList reviews={(data ?? []) as never} />
      )}
    </>
  );
}
