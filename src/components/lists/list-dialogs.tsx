"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, Pencil, Plus, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { createList, deleteList, updateList } from "@/app/(app)/lists/actions";
import { downloadExport } from "@/lib/download";

const SUGGESTIONS = ["UK Business Owners", "US CEOs", "London Marketing Managers", "Pakistani Software Companies", "UAE Real Estate Companies", "Potential Clients"];

export function ListFormDialog({ list, trigger }: { list?: { id: string; name: string; description: string | null }; trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(list?.name ?? "");
  const [desc, setDesc] = useState(list?.description ?? "");
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>{trigger ?? <Button><Plus /> New list</Button>}</span>
      <DialogContent title={list ? "Rename list" : "New lead list"}>
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = list ? await updateList(list.id, { name, description: desc }) : await createList({ name, description: desc });
            if (!r.ok) return void toast.error(r.error);
            toast.success(list ? "List updated" : "List created");
            setOpen(false);
            router.refresh();
          });
        }}>
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} /></Field>
          {!list ? <div className="flex flex-wrap gap-1.5">{SUGGESTIONS.map((s) => <button type="button" key={s} onClick={() => setName(s)} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs hover:bg-brand-50">{s}</button>)}</div> : null}
          <Field label="Description"><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} /></Field>
          <div className="flex justify-end"><Button disabled={pending}>{list ? "Save" : "Create list"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ListActions({ list }: { list: { id: string; name: string; description: string | null } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <ListFormDialog list={list} trigger={<Button variant="outline" size="sm"><Pencil /> Rename</Button>} />
      <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => { try { await downloadExport({ target: { filters: { list_id: list.id } }, format: "xlsx", name: list.name }); } catch (e) { toast.error((e as Error).message); } })}><Download /> XLSX</Button>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => { try { await downloadExport({ target: { filters: { list_id: list.id } }, format: "csv", name: list.name }); } catch (e) { toast.error((e as Error).message); } })}><Download /> CSV</Button>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}><Trash /> Delete</Button>
        <DialogContent title={`Delete “${list.name}”?`} description="The list is deleted. The leads in it are kept.">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => start(async () => { const r = await deleteList(list.id); if (r.ok) { router.push("/lists"); router.refresh(); } else toast.error(r.error); })}>Delete list</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
