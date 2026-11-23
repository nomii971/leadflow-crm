"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash } from "lucide-react";
import { Checkbox } from "@/components/ui/input";
import { PriorityBadge } from "@/components/shared/status-badges";
import type { Task } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { deleteTask, setTaskCompleted } from "@/app/(app)/leads/actions";

export function TaskList({ tasks, empty }: { tasks: Task[]; empty: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!tasks.length) return <p className="py-8 text-center text-sm text-slate-400">{empty}</p>;
  return (
    <ul className={cn("divide-y divide-slate-100", pending && "opacity-70")}>
      {tasks.map((t) => {
        const overdue = !t.completed && t.due_at && new Date(t.due_at) < new Date();
        return (
          <li key={t.id} className="flex items-start gap-3 px-1 py-3">
            <Checkbox className="mt-0.5" checked={t.completed} aria-label="Mark complete" onChange={(e) => start(async () => { await setTaskCompleted(t.id, e.target.checked); router.refresh(); })} />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", t.completed && "text-slate-400 line-through")}>{t.title}</p>
              <p className="text-xs text-slate-500">
                <span className={cn(overdue && "font-semibold text-rose-600")}>{t.due_at ? `${overdue ? "Overdue · " : ""}${formatDate(t.due_at, true)}` : "No due date"}</span>
                {" · "}{t.type.replace("_", " ")}
                {t.leads ? <> · <Link className="text-brand-600 hover:underline" href={`/leads/${t.lead_id}`}>{t.leads.full_name}</Link>{t.leads.company_name ? ` (${t.leads.company_name})` : ""}</> : null}
              </p>
            </div>
            <PriorityBadge priority={t.priority} />
            <button aria-label="Delete" onClick={() => start(async () => { await deleteTask(t.id); router.refresh(); })}><Trash className="size-3.5 text-slate-300 hover:text-rose-600" /></button>
          </li>
        );
      })}
    </ul>
  );
}
