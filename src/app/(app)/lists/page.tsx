import Link from "next/link";
import { ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ListFormDialog } from "@/components/lists/list-dialogs";
import { requireUserOrRedirect } from "@/lib/supabase/server";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata = { title: "Lead Lists" };

export default async function ListsPage() {
  const { supabase } = await requireUserOrRedirect();
  const { data } = await supabase.from("lead_lists_with_counts").select("*").order("updated_at", { ascending: false });
  const lists = (data ?? []) as { id: string; name: string; description: string | null; member_count: number; updated_at: string }[];
  return (
    <>
      <PageHeader icon={<ListChecks />} title="Lead Lists" description="Group leads into lists like “UAE Real Estate Companies”. Add leads from All Leads with bulk selection." actions={<ListFormDialog />} />
      {lists.length === 0 ? (
        <EmptyState icon={<ListChecks />} title="No lists yet" description="Create a list, then select leads in All Leads and choose “Add to list”." action={<ListFormDialog />} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lists.map((l) => (
            <Link key={l.id} href={`/lists/${l.id}`}>
              <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{l.name}</p>
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 tabular-nums">{formatNumber(Number(l.member_count))}</span>
                  </div>
                  {l.description ? <p className="mt-1 line-clamp-2 text-sm text-slate-500">{l.description}</p> : null}
                  <p className="mt-3 text-xs text-slate-400">Updated {formatDate(l.updated_at)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
