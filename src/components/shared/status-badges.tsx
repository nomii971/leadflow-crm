import { Badge } from "@/components/ui/badge";
import { COLLECTION_STATUS_META, IMPORT_STATUS_META, LEAD_STATUSES } from "@/lib/constants";

export function LeadStatusBadge({ status }: { status: string }) {
  const s = LEAD_STATUSES.find((x) => x.value === status);
  return <Badge tone={s?.color ?? "slate"} dot>{s?.label ?? status}</Badge>;
}

const PRIORITY_TONE: Record<string, string> = { low: "slate", medium: "blue", high: "amber", urgent: "rose" };
export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge tone={PRIORITY_TONE[priority] ?? "slate"}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</Badge>;
}

/** A "running" job without a heartbeat for 2 minutes is shown as interrupted (resumable). */
export function effectiveCollectionStatus(status: string, heartbeat: string | null) {
  if (status === "running" && (!heartbeat || Date.now() - new Date(heartbeat).getTime() > 120_000)) return "stalled";
  return status;
}

export function CollectionStatusBadge({ status, heartbeat }: { status: string; heartbeat?: string | null }) {
  const eff = effectiveCollectionStatus(status, heartbeat ?? null);
  if (eff === "stalled") return <Badge tone="rose" dot>Interrupted (resumable)</Badge>;
  const m = COLLECTION_STATUS_META[status];
  return <Badge tone={m?.tone ?? "slate"} dot>{m?.label ?? status}</Badge>;
}

export function ImportStatusBadge({ status }: { status: string }) {
  const m = IMPORT_STATUS_META[status];
  return <Badge tone={m?.tone ?? "slate"} dot>{m?.label ?? status}</Badge>;
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? <Badge tone="emerald">Verified</Badge> : <Badge tone="slate">Unverified</Badge>;
}
