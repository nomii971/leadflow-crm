import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { requireUserOrRedirect } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUserOrRedirect();
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("completed", false)
    .lt("due_at", new Date().toISOString());
  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} overdue={count ?? 0} />
      <main className="lg:pl-64">
        <Topbar />
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
