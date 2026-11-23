import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { TaskList } from "@/components/tasks/task-list";
import { TasksPanel } from "@/components/leads/lead-panels";
import { requireUserOrRedirect } from "@/lib/supabase/server";
import type { Task } from "@/lib/types";

export const metadata = { title: "Follow-ups" };

export default async function FollowUpsPage() {
  const { supabase } = await requireUserOrRedirect();
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 864e5).toISOString();
  const sel = "*, leads(full_name, company_name)";
  const [overdue, upcoming, later, done] = await Promise.all([
    supabase.from("tasks").select(sel).eq("completed", false).lt("due_at", now.toISOString()).order("due_at").limit(200),
    supabase.from("tasks").select(sel).eq("completed", false).gte("due_at", now.toISOString()).lte("due_at", weekEnd).order("due_at").limit(200),
    supabase.from("tasks").select(sel).eq("completed", false).or(`due_at.gt.${weekEnd},due_at.is.null`).order("due_at", { nullsFirst: false }).limit(200),
    supabase.from("tasks").select(sel).eq("completed", true).order("completed_at", { ascending: false }).limit(30),
  ]);
  const t = (r: { data: unknown }) => (r.data ?? []) as Task[];
  return (
    <>
      <PageHeader icon={<CalendarClock />} title="Follow-ups" description="Upcoming and overdue follow-up tasks across all leads." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="border-rose-200">
            <CardHeader><CardTitle className="text-rose-700">Overdue ({t(overdue).length})</CardTitle></CardHeader>
            <CardContent><TaskList tasks={t(overdue)} empty="Nothing overdue. Nice." /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Next 7 days ({t(upcoming).length})</CardTitle></CardHeader>
            <CardContent><TaskList tasks={t(upcoming)} empty="No follow-ups due this week." /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Later / no date ({t(later).length})</CardTitle></CardHeader>
            <CardContent><TaskList tasks={t(later)} empty="No other open follow-ups." /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Recently completed</CardTitle><CardDescription>Last 30</CardDescription></CardHeader>
            <CardContent><TaskList tasks={t(done)} empty="No completed follow-ups yet." /></CardContent>
          </Card>
        </div>
        <div><TasksPanel leadId={null} tasks={[]} /><p className="mt-2 text-xs text-slate-500">General tasks not tied to a lead. To attach a follow-up to a lead, add it from the lead&apos;s profile.</p></div>
      </div>
    </>
  );
}
