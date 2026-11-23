"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import { removeHubspotToken, saveHubspotToken } from "@/app/(app)/integrations/actions";

export function HubspotConnect({ saved, fromEnv }: { saved: { last4: string; updated_at?: string } | null; fromEnv: boolean }) {
  const [token, setToken] = useState("");
  const [editing, setEditing] = useState(!saved && !fromEnv);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (fromEnv) {
    return <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"><ShieldCheck className="size-4 text-emerald-600" />Token is set in the server environment (HUBSPOT_ACCESS_TOKEN).</p>;
  }

  if (saved && !editing) {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <ShieldCheck className="size-4" />Token saved, encrypted: <code className="font-mono">••••{saved.last4}</code>
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Replace token</Button>
          <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" disabled={pending}
            onClick={() => start(async () => {
              const r = await removeHubspotToken();
              if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error);
            })}>Disconnect</Button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await saveHubspotToken(token);
        if (r.ok) { toast.success(r.message); setToken(""); setEditing(false); router.refresh(); } else toast.error(r.error);
      });
    }}>
      <Field label="HubSpot private app token">
        <Input type="password" autoComplete="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} placeholder="pat-na1-…" />
      </Field>
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={pending || token.trim().length < 10}>{pending ? <Spinner /> : <KeyRound />} Connect HubSpot</Button>
        {saved ? <Button size="sm" type="button" variant="ghost" onClick={() => { setEditing(false); setToken(""); }}>Cancel</Button> : null}
      </div>
      <p className="text-[11px] text-slate-500">The token is checked with HubSpot, then stored encrypted in your database. It is only used on the server and is never shown again.</p>
    </form>
  );
}
